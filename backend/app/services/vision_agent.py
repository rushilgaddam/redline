"""Mock stand-in for the Sonnet-class vision + context agent (architecture §4 step 4).

Real system: one multimodal call gets the photo, the technician's raw text, the
resolved drawing's region list, and its context block, and returns a structured
{region, confidence, reasoning, diagnosis|null}. Here we simulate that contract
deterministically so the rest of the pipeline (confidence gate, routing, audit)
is exercised exactly as it would be in production, without calling out to a
paid model.
"""
import hashlib
import re
from dataclasses import dataclass, field

from .. import models

CONFIDENCE_THRESHOLD = 65

_STOPWORDS = {
    "the", "a", "an", "is", "are", "was", "it", "to", "and", "of", "on", "in",
    "at", "for", "this", "that", "with", "i", "my", "we", "our", "just", "did",
    "does", "keeps", "keep", "not", "no", "there", "here", "again", "still",
}


def _tokenize(text: str) -> set[str]:
    words = re.findall(r"[a-z0-9']+", text.lower())
    return {w for w in words if w not in _STOPWORDS and len(w) > 2}


def _stable_jitter(seed: str, spread: int = 6) -> int:
    """Deterministic pseudo-random jitter so identical inputs always score
    identically (reproducible demo) while different phrasing still varies."""
    h = int(hashlib.sha256(seed.encode()).hexdigest(), 16)
    return (h % (spread * 2 + 1)) - spread


@dataclass
class VisionResult:
    region: models.Region | None
    confidence: float
    reasoning: str
    diagnosis: str | None
    supported: bool
    matched_issue: dict | None = field(default=None)


def run_vision_agent(note_text: str, photo_hint: str, regions: list[models.Region]) -> VisionResult:
    if not regions:
        return VisionResult(None, 0, "Drawing has no decomposed regions yet.", None, False)

    note_tokens = _tokenize(note_text) | _tokenize(photo_hint)

    scored: list[tuple[float, models.Region, dict | None]] = []
    for region in regions:
        region_tokens = _tokenize(region.label) | _tokenize(region.description)
        region_tokens |= {k.lower() for k in (region.keywords or [])}

        overlap = note_tokens & region_tokens
        score = 18 * len(overlap)

        matched_issue = None
        best_issue_hits = 0
        for issue in region.known_issues or []:
            triggers = {t.lower() for t in issue.get("triggers", [])}
            hits = len(note_tokens & triggers)
            if hits > best_issue_hits:
                best_issue_hits = hits
                matched_issue = issue

        if matched_issue:
            score += 26 * best_issue_hits

        scored.append((score, region, matched_issue))

    scored.sort(key=lambda t: t[0], reverse=True)
    top_score, top_region, top_issue = scored[0]

    jitter = _stable_jitter(note_text + top_region.id)
    confidence = max(4, min(97, top_score + 30 + jitter))

    supported = confidence >= CONFIDENCE_THRESHOLD and top_issue is not None

    if supported:
        reasoning = (
            f"Photo/note language overlaps strongly with \"{top_region.label}\" "
            f"({top_region.description[:80]}...) and matches a known failure pattern "
            f"recorded in this drawing's context block."
        )
        diagnosis = top_issue["diagnosis"]
        confidence = max(confidence, top_issue.get("confidence", confidence))
    elif top_score > 0:
        reasoning = (
            f"Best region match is \"{top_region.label}\", but the drawing's context "
            f"block doesn't contain a grounded explanation for this symptom — "
            f"declining to guess."
        )
        diagnosis = None
    else:
        reasoning = (
            "No region on this drawing shares enough language with the photo/note "
            "to localize the issue confidently."
        )
        diagnosis = None

    return VisionResult(top_region, round(confidence, 1), reasoning, diagnosis, supported, top_issue)
