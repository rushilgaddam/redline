"""Real, deterministic CAD-QA checks (architecture §6, tier 1) — the piece
MOCKS.md called out as "fully buildable now against parsed DXF entities...
no Sonnet needed." Runs at ingestion time against the drawing's own real
geometry (`ingest.parse_dxf`'s `text_entities` / `line_segments`), not a
model call and not hand-authored per-drawing findings.

Three checks, each a plain geometric/text cross-reference over what a DXF
file actually contains:

1. Dangling wire endpoint — a LINE endpoint with no other entity's endpoint,
   circle (terminal/junction symbol), or text label near it. Approximates a
   real wire-continuity DRC check; DXF carries no netlist, so "near" is the
   best purely-geometric proxy available without one.
2. Duplicate reference designator across regions — the same equipment tag
   (K1, TB-1, CB-3, ...) appearing in two different auto-suggested regions.
   A tag repeating *within* one region (its own symbol + its own label) is
   normal and not flagged; only a cross-region repeat is, since that's the
   actual "same tag assigned to two different things" failure shape.
3. Unclustered label — a text entity that falls outside every suggested
   region's bounding box, a real candidate for an orphaned callout.

None of this replaces tier 2 (the critic-agent pass over GD&T/cross-view
reasoning MOCKS.md describes) — that's still not built. This tier alone is
genuinely real: it will find nothing on a clean drawing and something on an
engineered-broken one, which is exactly what `test_cad_qa_checks.py`
verifies.
"""
import math
import re
from dataclasses import dataclass

DESIGNATOR_RE = re.compile(r"^[A-Z]{1,4}-?\d{1,3}[A-Z]?$")
# Words that happen to match the designator shape but are drawing furniture,
# not equipment tags — keeps the duplicate/orphan checks from firing on
# every sheet's title block.
DESIGNATOR_STOPWORDS = {"REV", "SHT", "NO", "DWG"}

ENDPOINT_TOLERANCE_PX = 6.0
REGION_MARGIN_PX = 4.0
MAX_FINDINGS_PER_CHECK = 4
# check_dangling_wire_endpoints is O(n^2) over endpoints — fine for a normal
# schematic (a few hundred wires), not for a drawing with thousands of line
# entities. Skip that one check rather than let a big ingest hang; the other
# two checks stay O(n) and always run.
MAX_LINES_FOR_ENDPOINT_CHECK = 800


@dataclass
class RegionRef:
    id: str
    label: str
    bbox: tuple[float, float, float, float]  # x0, y0, x1, y1 in layout px


def _extract_designators(text: str) -> list[str]:
    out = []
    for token in re.split(r"[\s,;:]+", text.strip().upper()):
        token = token.strip(".()")
        if token and DESIGNATOR_RE.match(token) and token not in DESIGNATOR_STOPWORDS:
            out.append(token)
    return out


def _dist(ax, ay, bx, by) -> float:
    return math.hypot(ax - bx, ay - by)


def _point_in_bbox(x: float, y: float, bbox: tuple[float, float, float, float], margin: float = 0.0) -> bool:
    x0, y0, x1, y1 = bbox
    return (x0 - margin) <= x <= (x1 + margin) and (y0 - margin) <= y <= (y1 + margin)


def check_dangling_wire_endpoints(
    line_segments: list[tuple[float, float, float, float]],
    text_entities: list[dict],
    circle_centers: list[tuple[float, float]] | None = None,
) -> list[dict]:
    circle_centers = circle_centers or []
    endpoints = []
    for x1, y1, x2, y2 in line_segments:
        endpoints.append((x1, y1))
        endpoints.append((x2, y2))

    other_points = [(t["x"], t["y"]) for t in text_entities] + list(circle_centers)

    dangling = []
    for i, (x, y) in enumerate(endpoints):
        near_line_endpoint = any(
            j != i and _dist(x, y, ox, oy) <= ENDPOINT_TOLERANCE_PX for j, (ox, oy) in enumerate(endpoints)
        )
        if near_line_endpoint:
            continue
        near_other = any(_dist(x, y, ox, oy) <= ENDPOINT_TOLERANCE_PX * 2 for ox, oy in other_points)
        if near_other:
            continue
        dangling.append((x, y))

    findings = []
    for x, y in dangling[:MAX_FINDINGS_PER_CHECK]:
        findings.append({
            "x": x, "y": y, "region_id": None,
            "finding": (
                f"Line endpoint at ({x:.0f}, {y:.0f}) doesn't connect to any other line, terminal symbol, "
                f"or label within tolerance — possible dangling/unterminated wire end."
            ),
            "confidence": 58,
            "reasoning": (
                "Deterministic check: geometric endpoint-proximity scan over the drawing's real line "
                "entities (no netlist in a DXF, so proximity is a heuristic proxy for continuity — "
                "flag for a human look, not an autonomous call)."
            ),
            "check_type": "dangling_wire_endpoint",
        })
    return findings


def check_duplicate_reference_designators(
    text_entities: list[dict], regions: list[RegionRef],
) -> list[dict]:
    # tag -> set of region ids (or "unclustered") it appears in
    tag_regions: dict[str, dict[str, tuple[float, float]]] = {}
    for t in text_entities:
        for tag in _extract_designators(t["text"]):
            owning = next((r for r in regions if _point_in_bbox(t["x"], t["y"], r.bbox, REGION_MARGIN_PX)), None)
            # A tag with no owning region is its own location, not a shared
            # "unclustered" bucket — two different unclustered occurrences of
            # the same tag are still two different places on the drawing and
            # should still be able to trip this check.
            key = owning.id if owning else f"unclustered:{t['x']:.0f},{t['y']:.0f}"
            tag_regions.setdefault(tag, {})
            if key not in tag_regions[tag]:
                tag_regions[tag][key] = (t["x"], t["y"])

    findings = []
    for tag, region_hits in tag_regions.items():
        if len(region_hits) < 2:
            continue
        region_ids = list(region_hits.keys())
        labels = [next((r.label for r in regions if r.id == rid), "an unclustered area") for rid in region_ids]
        x, y = list(region_hits.values())[0]
        findings.append({
            "x": x, "y": y, "region_id": region_ids[0] if region_ids[0] != "unclustered" else None,
            "finding": (
                f"Reference designator \"{tag}\" appears in {len(region_hits)} different regions of this "
                f"drawing ({', '.join(labels)}) — verify this isn't a duplicate/reused tag rather than one "
                f"component referenced twice."
            ),
            "confidence": 64,
            "reasoning": (
                "Deterministic check: same equipment tag text found inside two different auto-suggested "
                "region clusters — a tag repeating within a single region (its own symbol + its own "
                "label) is normal and not flagged."
            ),
            "check_type": "duplicate_reference_designator",
        })
        if len(findings) >= MAX_FINDINGS_PER_CHECK:
            break
    return findings


def check_unclustered_labels(text_entities: list[dict], regions: list[RegionRef]) -> list[dict]:
    findings = []
    for t in text_entities:
        tags = _extract_designators(t["text"])
        if not tags:
            continue  # only flag real equipment-tag-shaped labels, not every stray note
        inside_any = any(_point_in_bbox(t["x"], t["y"], r.bbox, REGION_MARGIN_PX) for r in regions)
        if inside_any:
            continue
        findings.append({
            "x": t["x"], "y": t["y"], "region_id": None,
            "finding": (
                f"Label \"{t['text'][:40]}\" falls outside every auto-suggested region on this drawing — "
                f"possible orphaned callout left over from a prior revision, or a region that still needs "
                f"manual placement."
            ),
            "confidence": 55,
            "reasoning": "Deterministic check: text entity position vs. every confirmed region's bounding box.",
            "check_type": "orphaned_reference",
        })
        if len(findings) >= MAX_FINDINGS_PER_CHECK:
            break
    return findings


def run_deterministic_checks(
    text_entities: list[dict],
    line_segments: list[tuple[float, float, float, float]],
    regions: list[RegionRef],
    circle_centers: list[tuple[float, float]] | None = None,
) -> list[dict]:
    """The real tier-1 CAD-QA pass. Returns findings in the same shape as
    hand-authored seed findings (region_id/x/y/finding/confidence/reasoning/
    check_type) so `cad_qa.run_cad_qa_scan` doesn't need to know the
    difference."""
    findings: list[dict] = []
    if len(line_segments) <= MAX_LINES_FOR_ENDPOINT_CHECK:
        findings += check_dangling_wire_endpoints(line_segments, text_entities, circle_centers)
    findings += check_duplicate_reference_designators(text_entities, regions)
    findings += check_unclustered_labels(text_entities, regions)
    return findings
