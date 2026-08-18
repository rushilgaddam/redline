"""Site Knowledge Agent (§ new — external context aggregation).

Real system: an engineer authorizes access to a context source (Outlook,
Teams, a shared drive) for their site; a sync pipeline pulls and indexes
content from it; retrieval at answer-time uses real embeddings. See
MOCKS.md for the exact real-vs-mock boundary — nothing here calls a real
API or a real embedding model. "Connecting" a source is a UI flow only, and
ingested documents are pasted/typed by the engineer standing in for what a
real sync would pull. Retrieval is the same token-overlap heuristic as
vision_agent.py and knowledge_reuse.py, kept deliberately consistent with
those so the whole prototype's "mock AI" reads as one coherent simulation
rather than three different fake behaviors.
"""
import re
from dataclasses import dataclass

from .. import models

MATCH_THRESHOLD = 30  # same 0-100ish scale as vision_agent's confidence

_STOPWORDS = {
    "the", "a", "an", "is", "are", "was", "it", "to", "and", "of", "on", "in",
    "at", "for", "this", "that", "with", "i", "my", "we", "our", "just", "did",
    "does", "keeps", "keep", "not", "no", "there", "here", "again", "still",
}


def _tokenize(text: str) -> set[str]:
    normalized = re.sub(r"(?<=[a-z0-9])-(?=[a-z0-9])", "", text.lower())
    words = re.findall(r"[a-z0-9']+", normalized)
    return {w for w in words if w not in _STOPWORDS and len(w) > 2}


@dataclass
class SiteKnowledgeMatch:
    document: models.KnowledgeDocument
    confidence: float
    excerpt: str


def find_relevant_document(
    note_text: str, photo_hint: str, documents: list[models.KnowledgeDocument]
) -> SiteKnowledgeMatch | None:
    if not documents:
        return None

    query_tokens = _tokenize(note_text) | _tokenize(photo_hint)
    if not query_tokens:
        return None

    best_doc, best_score = None, 0
    for doc in documents:
        doc_tokens = _tokenize(doc.title) | _tokenize(doc.content)
        doc_tokens |= {k.lower() for k in (doc.keywords or [])}
        overlap = query_tokens & doc_tokens
        score = 22 * len(overlap)
        if score > best_score:
            best_score, best_doc = score, doc

    if not best_doc or best_score < MATCH_THRESHOLD:
        return None

    confidence = max(4, min(96, best_score + 34))
    excerpt = best_doc.content.strip()
    if len(excerpt) > 320:
        excerpt = excerpt[:320].rsplit(" ", 1)[0] + "…"

    return SiteKnowledgeMatch(document=best_doc, confidence=confidence, excerpt=excerpt)


def source_label(source_type: str) -> str:
    return {"outlook": "an Outlook email", "teams": "a Teams message", "manual": "a site note"}.get(
        source_type, "site knowledge"
    )
