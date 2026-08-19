"""Engineer-facing assistant ("Ask anything"). Real, not mocked in the sense
that matters most: every answer is computed live from the actual database —
open/overdue counts, drawing lookups, resolution stats — not a canned string
and not a real LLM call either. See MOCKS.md: the natural-language *routing*
(matching a free-text question to one of these intents) is a deterministic
keyword/regex matcher, not real NLU, so it only understands the phrasings
below — anything else gets an honest "here's what I can answer" fallback
rather than a guess.
"""
import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models

OPEN_SLA_HOURS = 24
TENTATIVE_SLA_HOURS = 48


@dataclass
class AssistantAnswer:
    text: str
    flag_ids: list[str] = field(default_factory=list)
    drawing_ids: list[str] = field(default_factory=list)


def _scoped_flags(db: Session, engineer: models.User, site_id: str | None) -> list[models.Flag]:
    q = select(models.Flag)
    if engineer.role != "reviewer":
        q = q.where(models.Flag.routed_to_user_id == engineer.id)
    flags = list(db.execute(q).scalars().all())
    if site_id:
        drawing_ids = {d.id for d in db.execute(select(models.Drawing).where(models.Drawing.site_id == site_id)).scalars()}
        flags = [f for f in flags if f.drawing_id in drawing_ids]
    return flags


def _drawing_label(db: Session, drawing_id: str) -> str:
    d = db.get(models.Drawing, drawing_id)
    return f"{d.drawing_number} — {d.title}" if d else "an unknown drawing"


def _now():
    return datetime.now(timezone.utc)


def _age_hours(dt: datetime) -> float:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return (_now() - dt).total_seconds() / 3600


_DRAWING_NUMBER_RE = re.compile(r"\b([A-Z]{1,3}-\d{3,5})\b", re.IGNORECASE)


def answer_question(db: Session, engineer: models.User, question: str, site_id: str | None = None) -> AssistantAnswer:
    q = question.lower().strip()

    # --- specific drawing lookup, e.g. "what's the status of E-1042?"
    dwg_match = _DRAWING_NUMBER_RE.search(question)
    if dwg_match:
        number = dwg_match.group(1).upper()
        drawing = db.execute(
            select(models.Drawing).where(models.Drawing.drawing_number == number)
        ).scalars().first()
        if not drawing:
            return AssistantAnswer(f"I don't have a drawing numbered {number}.")
        flags = [f for f in db.execute(select(models.Flag).where(models.Flag.drawing_id == drawing.id)).scalars()]
        open_flags = [f for f in flags if f.status != "resolved"]
        author = db.get(models.User, drawing.primary_author_id)
        status_note = "needs region confirmation" if drawing.confidence_floor_status == "needs_review" else "confirmed"
        parts = [
            f"{drawing.drawing_number} Rev {drawing.revision} — \"{drawing.title}\" — author of record {author.name if author else 'unknown'}, {status_note}."
        ]
        if open_flags:
            parts.append(f"{len(open_flags)} active flag{'s' if len(open_flags) != 1 else ''} on it right now.")
        else:
            parts.append("No active flags on it.")
        return AssistantAnswer(" ".join(parts), flag_ids=[f.id for f in open_flags], drawing_ids=[drawing.id])

    flags = _scoped_flags(db, engineer, site_id)
    active = [f for f in flags if f.status != "resolved"]

    # --- pending / attention-needed
    if any(kw in q for kw in ("pending", "attention", "look at", "waiting", "queue", "what's up", "anything for me")):
        if not active:
            return AssistantAnswer("Nothing pending — you're caught up.")
        active.sort(key=lambda f: f.created_at)
        oldest = active[:5]
        lines = [_flag_line(db, f) for f in oldest]
        more = f" (+{len(active) - 5} more)" if len(active) > 5 else ""
        return AssistantAnswer(
            f"{len(active)} flag{'s' if len(active) != 1 else ''} need your attention, oldest first:\n" + "\n".join(lines) + more,
            flag_ids=[f.id for f in oldest],
        )

    # --- overdue
    if "overdue" in q or "late" in q or "sla" in q:
        overdue = [
            f for f in active
            if (f.status == "open" and _age_hours(f.created_at) > OPEN_SLA_HOURS)
            or (f.status == "answered" and _age_hours(f.created_at) > TENTATIVE_SLA_HOURS)
        ]
        if not overdue:
            return AssistantAnswer("Nothing overdue right now.")
        overdue.sort(key=lambda f: f.created_at)
        lines = [_flag_line(db, f) for f in overdue[:5]]
        return AssistantAnswer(
            f"{len(overdue)} flag{'s' if len(overdue) != 1 else ''} past the usual response window:\n" + "\n".join(lines),
            flag_ids=[f.id for f in overdue[:5]],
        )

    # --- resolved today / recent activity
    if "today" in q or "resolved" in q or "done" in q or "finished" in q:
        resolved_today = [
            f for f in flags
            if f.status == "resolved" and f.resolved_at and f.resolved_at.date() == _now().date()
        ]
        if not resolved_today:
            return AssistantAnswer("Nothing resolved yet today.")
        lines = [_flag_line(db, f) for f in resolved_today[:5]]
        return AssistantAnswer(
            f"Resolved today: {len(resolved_today)}\n" + "\n".join(lines),
            flag_ids=[f.id for f in resolved_today[:5]],
        )

    # --- counts / status summary
    if any(kw in q for kw in ("how many", "status", "summary", "how are we", "how's it going", "progress")):
        open_n = sum(1 for f in flags if f.status == "open")
        tentative_n = sum(1 for f in flags if f.status == "answered")
        resolved_n = sum(1 for f in flags if f.status == "resolved")
        total = open_n + tentative_n + resolved_n
        rate = round(100 * resolved_n / total) if total else 0
        return AssistantAnswer(
            f"{open_n} open, {tentative_n} tentative (awaiting your confirmation), {resolved_n} resolved "
            f"— {rate}% resolution rate across {total} flag{'s' if total != 1 else ''}."
        )

    return AssistantAnswer(
        "I can answer questions like \"anything pending?\", \"what's overdue?\", \"what did I resolve today?\", "
        "\"how's E-1042 doing?\", or \"what's my status?\" — try one of those."
    )


def _flag_line(db: Session, flag: models.Flag) -> str:
    label = _drawing_label(db, flag.drawing_id)
    note = flag.note[:70] + ("…" if len(flag.note) > 70 else "")
    return f"• {label}: {note}"
