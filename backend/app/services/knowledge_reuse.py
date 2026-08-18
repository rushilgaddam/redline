"""Lightweight retrieval pass against resolved flags on the same drawing/region
(architecture §5). Real system embeds with sentence-transformers/Voyage + pgvector;
here we use token-overlap (Jaccard) similarity, which is enough to demonstrate the
"surface the past resolution, never suppress escalation" behavior."""
import re

from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models

MATCH_THRESHOLD = 0.22

_STOPWORDS = {
    "the", "a", "an", "is", "are", "was", "it", "to", "and", "of", "on", "in",
    "at", "for", "this", "that", "with", "i", "my", "we", "our", "just", "did",
    "does", "keeps", "keep", "not", "no", "there", "here", "again", "still", "but",
}


def _tokens(text: str) -> set[str]:
    normalized = re.sub(r"(?<=[a-z0-9])-(?=[a-z0-9])", "", text.lower())
    words = re.findall(r"[a-z0-9']+", normalized)
    return {w for w in words if w not in _STOPWORDS and len(w) > 2}


def find_similar_resolution(db: Session, drawing_id: str, region_id: str | None, note: str) -> models.Flag | None:
    q = select(models.Flag).where(
        models.Flag.drawing_id == drawing_id,
        models.Flag.status == "resolved",
    )
    if region_id:
        q = q.where(models.Flag.region_id == region_id)
    past_flags = db.execute(q).scalars().all()

    note_tokens = _tokens(note)
    if not note_tokens or not past_flags:
        return None

    best_flag, best_score = None, 0.0
    for flag in past_flags:
        other = _tokens(flag.note)
        if not other:
            continue
        jaccard = len(note_tokens & other) / len(note_tokens | other)
        if jaccard > best_score:
            best_score, best_flag = jaccard, flag

    if best_flag and best_score >= MATCH_THRESHOLD:
        return best_flag
    return None
