"""Tests for real region auto-labeling on ingestion (services/region_labeling.py).
Before this, every auto-suggested region was named "Region N" with a generic
placeholder description regardless of what the drawing actually says near
it — MOCKS.md's own words. These pin down the deterministic proximity read
that replaces that generic label with the drawing's own text whenever
there's something legible nearby, and confirm it still falls back honestly
when there isn't.
"""
import io

import ezdxf
from fastapi.testclient import TestClient

from app.database import Base, SessionLocal, engine
from app.main import app
from app.seed import seed
from app.services import region_labeling as rl

SEARCH_RADIUS = 20.0


def test_designator_shaped_text_used_verbatim():
    bbox = (0.0, 0.0, 100.0, 100.0)
    texts = [{"text": "k1", "x": 50, "y": 50}]  # lowercase in the DXF — should normalize
    proposal = rl.propose_label(bbox, texts, SEARCH_RADIUS)
    assert proposal is not None
    assert proposal.label == "K1"
    assert proposal.from_designator is True


def test_prefers_designator_over_closer_plain_text():
    bbox = (0.0, 0.0, 10.0, 10.0)
    texts = [
        {"text": "assembly detail", "x": 5, "y": 5},  # closer, but not a designator
        {"text": "TB-1", "x": 15, "y": 15},  # farther, but a real tag
    ]
    proposal = rl.propose_label(bbox, texts, SEARCH_RADIUS)
    assert proposal.label == "TB-1"
    assert proposal.from_designator is True


def test_falls_back_to_nearest_plain_text_when_no_designator_nearby():
    bbox = (0.0, 0.0, 10.0, 10.0)
    texts = [{"text": "control transformer", "x": 5, "y": 5}]
    proposal = rl.propose_label(bbox, texts, SEARCH_RADIUS)
    assert proposal.label == "control transformer"
    assert proposal.from_designator is False


def test_no_nearby_text_returns_none():
    bbox = (0.0, 0.0, 10.0, 10.0)
    texts = [{"text": "K1", "x": 5000, "y": 5000}]
    assert rl.propose_label(bbox, texts, SEARCH_RADIUS) is None


def test_overlong_plain_text_not_used_as_a_label():
    bbox = (0.0, 0.0, 10.0, 10.0)
    long_note = "this is a long engineering note that should never become a region label text"
    texts = [{"text": long_note, "x": 5, "y": 5}]
    assert rl.propose_label(bbox, texts, SEARCH_RADIUS) is None


def test_title_block_stopwords_are_not_treated_as_designators():
    bbox = (0.0, 0.0, 10.0, 10.0)
    texts = [{"text": "REV", "x": 5, "y": 5}]
    proposal = rl.propose_label(bbox, texts, SEARCH_RADIUS)
    # "REV" matches the designator shape but is a stopword — falls back to
    # being used as plain nearby text instead of being mistaken for a tag.
    assert proposal.from_designator is False
    assert proposal.label == "REV"


# --------------------------------------------------------------------------- ingestion integration
def setup_module(module):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed(db)
    finally:
        db.close()


client = TestClient(app)


def _build_labeled_dxf() -> bytes:
    doc = ezdxf.new()
    msp = doc.modelspace()
    # A closed square outline + a concentric circle — guaranteed to cluster
    # into exactly one region — with a real tag label sitting just above it,
    # the same layout a real symbol + its reference designator would have.
    msp.add_lwpolyline([(0, 0), (20, 0), (20, 20), (0, 20)], close=True)
    msp.add_circle((10, 10), radius=2)
    msp.add_text("K1", dxfattribs={"insert": (2, 21), "height": 3})
    buf = io.StringIO()
    doc.write(buf)
    return buf.getvalue().encode("utf-8")


def test_real_ingest_labels_a_region_from_its_own_nearby_text():
    engineers = client.get("/api/users?role=engineer").json()
    seeded = [e for e in engineers if not (e["email"] or "").endswith("@example.com")]
    eng = seeded[0]
    token = client.post(f"/api/users/{eng['id']}/demo-login").json()["access_token"]

    resp = client.post(
        "/api/drawings/ingest",
        files={"file": ("labeled.dxf", _build_labeled_dxf(), "application/dxf")},
        data={
            "drawing_number": "TEST-9002",
            "revision": "A",
            "title": "Region labeling fixture",
            "discipline": "Electrical",
            "site_id": eng["site_ids"][0],
            "primary_author_id": eng["id"],
            "context_block": "",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200, resp.text
    regions = resp.json()["drawing"]["regions"]
    assert len(regions) == 1
    assert regions[0]["label"] == "K1"
    assert "K1" in regions[0]["description"]
