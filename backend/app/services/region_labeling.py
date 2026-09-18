"""Real region auto-labeling on ingestion (architecture §3). MOCKS.md called
this "a good fit for a cheap/fast model call (Haiku-class) per cluster" —
that's true for the general case, but for the specific, narrow signal this
actually needs (the equipment tag already silkscreened right next to its own
symbol on the drawing), a deterministic proximity read of the DXF's own real
text entities gets there without a model call at all. No API key required,
no per-drawing cost, and it fails closed the same way title_block_ocr.py
does: if nothing legible is nearby, the region keeps the honest generic
placeholder ("Region N") instead of guessing.

This intentionally doesn't replace the "good fit for Haiku" framing in
MOCKS.md — a real symbol-shape/text-block reading model pass would do
better on drawings where the tag isn't positioned right next to its symbol.
This is the geometric floor under that: cheap, free, and correct whenever
the tag *is* nearby, which is true often enough (title blocks, reference
designators next to their component) to be worth doing for real now.
"""
import math
from dataclasses import dataclass

from .cad_qa_checks import DESIGNATOR_STOPWORDS, DESIGNATOR_RE

MAX_LABEL_SEARCH_MULTIPLE = 3.0  # multiples of the clustering margin
MAX_PLAIN_LABEL_LEN = 40


@dataclass
class LabelProposal:
    label: str
    source_text: str
    from_designator: bool


def _center(bbox: tuple[float, float, float, float]) -> tuple[float, float]:
    x0, y0, x1, y1 = bbox
    return (x0 + x1) / 2, (y0 + y1) / 2


def _dist_to_bbox(x: float, y: float, bbox: tuple[float, float, float, float]) -> float:
    x0, y0, x1, y1 = bbox
    dx = max(x0 - x, 0.0, x - x1)
    dy = max(y0 - y, 0.0, y - y1)
    return math.hypot(dx, dy)


def propose_label(
    bbox: tuple[float, float, float, float], text_entities: list[dict], search_radius: float,
) -> LabelProposal | None:
    """Look for a real text entity in/near this region's bbox and propose it
    as the region's label — a designator-shaped tag (K1, TB-1, CB-3, ...) is
    preferred and used verbatim; otherwise a short nearby note is used as-is.
    Ties broken by distance to bbox center, so a label physically closer to
    "the middle of the cluster" wins over one just barely in range."""
    candidates = []
    for t in text_entities:
        d = _dist_to_bbox(t["x"], t["y"], bbox)
        if d <= search_radius:
            candidates.append((d, t))
    if not candidates:
        return None
    candidates.sort(key=lambda c: c[0])

    for _, t in candidates:
        token = t["text"].strip().upper()
        if DESIGNATOR_RE.match(token) and token not in DESIGNATOR_STOPWORDS:
            return LabelProposal(label=token, source_text=t["text"], from_designator=True)

    _, nearest = candidates[0]
    text = nearest["text"].strip()
    if text and len(text) <= MAX_PLAIN_LABEL_LEN:
        return LabelProposal(label=text, source_text=text, from_designator=False)
    return None
