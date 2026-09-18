"""Tests for the real tier-1 CAD-QA deterministic checks (services/cad_qa_checks.py).

Unit tests on the pure geometry/text functions first — fast, and pin down
the exact "should flag" / "should not false-positive" shape of each check.
Then one ingestion-level integration test that builds a real minimal DXF
in-memory (via ezdxf, the same library ingest.py uses for real parsing) with
a deliberately broken duplicate designator, and checks the POST /ingest
endpoint actually surfaces it — not just that the pure function works in
isolation.
"""
import io

import ezdxf
from fastapi.testclient import TestClient

from app import models
from app.database import Base, SessionLocal, engine
from app.main import app
from app.seed import seed
from app.services import cad_qa_checks as qc


def _region(id_, label, bbox):
    return qc.RegionRef(id=id_, label=label, bbox=bbox)


# --------------------------------------------------------------------------- dangling endpoints
def test_dangling_endpoint_flagged_when_isolated():
    # A single line with both ends far from anything else.
    lines = [(0, 0, 100, 0)]
    findings = qc.check_dangling_wire_endpoints(lines, text_entities=[])
    assert len(findings) == 2  # both endpoints dangling
    assert findings[0]["check_type"] == "dangling_wire_endpoint"


def test_connected_endpoints_not_flagged():
    # Two lines sharing an endpoint — a real corner, not dangling.
    lines = [(0, 0, 100, 0), (100, 0, 100, 100)]
    findings = qc.check_dangling_wire_endpoints(lines, text_entities=[])
    # (0,0) and (100,100) are still isolated; (100,0) is shared and shouldn't appear
    flagged_points = {(f["x"], f["y"]) for f in findings}
    assert (100, 0) not in flagged_points


def test_endpoint_near_circle_not_flagged():
    # A wire ending at a terminal/junction symbol (circle) is normal.
    lines = [(0, 0, 100, 0)]
    findings = qc.check_dangling_wire_endpoints(lines, text_entities=[], circle_centers=[(100, 1)])
    flagged_points = {(round(f["x"]), round(f["y"])) for f in findings}
    assert (100, 0) not in flagged_points
    assert (0, 0) in flagged_points


# --------------------------------------------------------------------------- duplicate designators
def test_duplicate_designator_across_regions_flagged():
    regions = [_region("r1", "Region 1", (0, 0, 50, 50)), _region("r2", "Region 2", (200, 200, 250, 250))]
    texts = [{"text": "K1", "x": 10, "y": 10}, {"text": "K1", "x": 210, "y": 210}]
    findings = qc.check_duplicate_reference_designators(texts, regions)
    assert len(findings) == 1
    assert findings[0]["check_type"] == "duplicate_reference_designator"
    assert "K1" in findings[0]["finding"]


def test_designator_repeated_within_one_region_not_flagged():
    # A tag's symbol + its own label, both inside the same region — normal.
    regions = [_region("r1", "Region 1", (0, 0, 100, 100))]
    texts = [{"text": "K1", "x": 10, "y": 10}, {"text": "K1", "x": 20, "y": 20}]
    findings = qc.check_duplicate_reference_designators(texts, regions)
    assert findings == []


def test_title_block_words_dont_look_like_duplicate_designators():
    regions = [_region("r1", "Region 1", (0, 0, 50, 50)), _region("r2", "Region 2", (200, 200, 250, 250))]
    texts = [{"text": "REV C", "x": 10, "y": 10}, {"text": "REV C", "x": 210, "y": 210}]
    findings = qc.check_duplicate_reference_designators(texts, regions)
    assert findings == []


# --------------------------------------------------------------------------- unclustered labels
def test_unclustered_equipment_tag_flagged():
    regions = [_region("r1", "Region 1", (0, 0, 50, 50))]
    texts = [{"text": "TB-9", "x": 500, "y": 500}]
    findings = qc.check_unclustered_labels(texts, regions)
    assert len(findings) == 1
    assert findings[0]["check_type"] == "orphaned_reference"


def test_label_inside_a_region_not_flagged():
    regions = [_region("r1", "Region 1", (0, 0, 50, 50))]
    texts = [{"text": "TB-9", "x": 10, "y": 10}]
    assert qc.check_unclustered_labels(texts, regions) == []


def test_non_designator_note_never_flagged_as_orphaned():
    # A stray annotation like "SEE DETAIL A" shouldn't trip this check —
    # only actual equipment-tag-shaped text should.
    regions = [_region("r1", "Region 1", (0, 0, 50, 50))]
    texts = [{"text": "SEE DETAIL A ON SHEET 3", "x": 500, "y": 500}]
    assert qc.check_unclustered_labels(texts, regions) == []


# --------------------------------------------------------------------------- clean drawing = no findings
def test_clean_drawing_produces_no_findings():
    regions = [_region("r1", "Region 1", (0, 0, 100, 100))]
    texts = [{"text": "K1", "x": 10, "y": 10}]
    lines = [(0, 0, 50, 0), (50, 0, 50, 50), (50, 50, 0, 0)]  # a closed triangle — every endpoint shared
    findings = qc.run_deterministic_checks(texts, lines, regions)
    assert findings == []


# --------------------------------------------------------------------------- ingestion integration
def setup_module(module):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed(db)
    finally:
        db.close()


client = TestClient(app)


def _build_broken_dxf() -> bytes:
    """A minimal real DXF with a duplicate reference designator planted far
    apart on the sheet — two separate clusters of geometry both labeled K1,
    which should trigger check_duplicate_reference_designators once parsed
    through the real ingest.parse_dxf pipeline, not a synthetic RegionRef."""
    doc = ezdxf.new()
    msp = doc.modelspace()
    # Cluster A, near the origin
    msp.add_line((0, 0), (20, 0))
    msp.add_line((0, 0), (0, 20))
    msp.add_circle((10, 10), radius=2)
    msp.add_text("K1", dxfattribs={"insert": (0, 25), "height": 3})
    # Cluster B, far away — reuses the same tag "K1"
    msp.add_line((500, 500), (520, 500))
    msp.add_line((500, 500), (500, 520))
    msp.add_circle((510, 510), radius=2)
    msp.add_text("K1", dxfattribs={"insert": (500, 525), "height": 3})

    buf = io.StringIO()
    doc.write(buf)
    return buf.getvalue().encode("utf-8")


def _login_as_first_engineer():
    engineers = client.get("/api/users?role=engineer").json()
    # Other test modules sharing this DB may have registered password-
    # protected accounts (see test_auth.py) — pick an actual seed engineer,
    # which stays demo-loginable.
    seeded = [e for e in engineers if not (e["email"] or "").endswith("@example.com")]
    eng = seeded[0]
    token = client.post(f"/api/users/{eng['id']}/demo-login").json()["access_token"]
    return eng, token


def test_real_dxf_ingest_surfaces_a_real_duplicate_designator_finding():
    eng, token = _login_as_first_engineer()
    site_id = eng["site_ids"][0]
    dxf_bytes = _build_broken_dxf()

    resp = client.post(
        "/api/drawings/ingest",
        files={"file": ("broken.dxf", dxf_bytes, "application/dxf")},
        data={
            "drawing_number": "TEST-9001",
            "revision": "A",
            "title": "CAD-QA check fixture",
            "discipline": "Electrical",
            "site_id": site_id,
            "primary_author_id": eng["id"],
            "context_block": "",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200, resp.text
    drawing = resp.json()["drawing"]
    assert drawing["cad_qa_checks_available"] is True
    # cad_qa_findings isn't exposed on DrawingDetailOut — verify via the DB directly.
    db = SessionLocal()
    try:
        row = db.get(models.Drawing, drawing["id"])
        check_types = {f["check_type"] for f in row.cad_qa_findings}
        assert "duplicate_reference_designator" in check_types
    finally:
        db.close()
