import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, Float, ForeignKey, String, Text, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def gen_id() -> str:
    return uuid.uuid4().hex[:12]


def now() -> datetime:
    return datetime.now(timezone.utc)


class Organization(Base):
    __tablename__ = "organizations"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_id)
    name: Mapped[str] = mapped_column(String)
    retention_days: Mapped[int] = mapped_column(default=180)

    sites: Mapped[list["Site"]] = relationship(back_populates="organization")
    users: Mapped[list["User"]] = relationship(back_populates="organization")


class Site(Base):
    __tablename__ = "sites"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_id)
    org_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"))
    name: Mapped[str] = mapped_column(String)
    address: Mapped[str] = mapped_column(String, default="")

    organization: Mapped["Organization"] = relationship(back_populates="sites")
    drawings: Mapped[list["Drawing"]] = relationship(back_populates="site")


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_id)
    org_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"))
    role: Mapped[str] = mapped_column(String)  # technician | engineer | reviewer | admin
    name: Mapped[str] = mapped_column(String)
    phone: Mapped[str | None] = mapped_column(String, nullable=True)
    email: Mapped[str | None] = mapped_column(String, nullable=True)
    discipline: Mapped[str | None] = mapped_column(String, nullable=True)
    title: Mapped[str | None] = mapped_column(String, nullable=True)
    avatar_color: Mapped[str] = mapped_column(String, default="#3ee6c4")
    backup_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    out_of_office: Mapped[bool] = mapped_column(Boolean, default=False)
    site_ids: Mapped[list] = mapped_column(JSON, default=list)

    organization: Mapped["Organization"] = relationship(back_populates="users")


class Drawing(Base):
    __tablename__ = "drawings"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_id)
    site_id: Mapped[str] = mapped_column(ForeignKey("sites.id"))
    drawing_number: Mapped[str] = mapped_column(String)
    revision: Mapped[str] = mapped_column(String)
    title: Mapped[str] = mapped_column(String)
    discipline: Mapped[str] = mapped_column(String)
    primary_author_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    backup_author_ids: Mapped[list] = mapped_column(JSON, default=list)
    context_block: Mapped[str] = mapped_column(Text, default="")
    revision_notes: Mapped[str] = mapped_column(Text, default="")
    confidence_floor_status: Mapped[str] = mapped_column(String, default="verified")  # verified | needs_review
    layout: Mapped[dict] = mapped_column(JSON, default=dict)  # rendering instructions for the CAD viewer
    cad_qa_findings: Mapped[list] = mapped_column(JSON, default=list)  # seeded background-scan findings
    cad_qa_scanned: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String, default="active")  # active | closed
    closed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)

    site: Mapped["Site"] = relationship(back_populates="drawings")
    regions: Mapped[list["Region"]] = relationship(back_populates="drawing", cascade="all, delete-orphan")
    flags: Mapped[list["Flag"]] = relationship(back_populates="drawing", cascade="all, delete-orphan")


class Region(Base):
    __tablename__ = "regions"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_id)
    drawing_id: Mapped[str] = mapped_column(ForeignKey("drawings.id"))
    label: Mapped[str] = mapped_column(String)
    description: Mapped[str] = mapped_column(Text, default="")
    keywords: Mapped[list] = mapped_column(JSON, default=list)
    known_issues: Mapped[list] = mapped_column(JSON, default=list)
    bbox_x: Mapped[float] = mapped_column(Float)
    bbox_y: Mapped[float] = mapped_column(Float)
    bbox_w: Mapped[float] = mapped_column(Float)
    bbox_h: Mapped[float] = mapped_column(Float)

    drawing: Mapped["Drawing"] = relationship(back_populates="regions")


class Flag(Base):
    __tablename__ = "flags"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_id)
    drawing_id: Mapped[str] = mapped_column(ForeignKey("drawings.id"))
    region_id: Mapped[str | None] = mapped_column(ForeignKey("regions.id"), nullable=True)
    x: Mapped[float] = mapped_column(Float, default=0)
    y: Mapped[float] = mapped_column(Float, default=0)
    status: Mapped[str] = mapped_column(String, default="open")  # open | answered | resolved
    source: Mapped[str] = mapped_column(String, default="sms")  # sms | cad_qa
    technician_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    photo_ref: Mapped[str | None] = mapped_column(String, nullable=True)
    note: Mapped[str] = mapped_column(Text, default="")
    ai_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    ai_reasoning: Mapped[str | None] = mapped_column(Text, nullable=True)
    ai_diagnosis: Mapped[str | None] = mapped_column(Text, nullable=True)
    knowledge_reuse_flag_id: Mapped[str | None] = mapped_column(String, nullable=True)
    site_knowledge_document_id: Mapped[str | None] = mapped_column(String, nullable=True)
    routed_to_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    drawing: Mapped["Drawing"] = relationship(back_populates="flags")
    messages: Mapped[list["Message"]] = relationship(back_populates="flag", cascade="all, delete-orphan")


class Message(Base):
    __tablename__ = "messages"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_id)
    flag_id: Mapped[str] = mapped_column(ForeignKey("flags.id"))
    sender: Mapped[str] = mapped_column(String)  # technician | ai | engineer | system
    sender_name: Mapped[str | None] = mapped_column(String, nullable=True)
    text: Mapped[str] = mapped_column(Text, default="")
    photo_ref: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)

    flag: Mapped["Flag"] = relationship(back_populates="messages")


class AuditEvent(Base):
    __tablename__ = "audit_events"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_id)
    flag_id: Mapped[str | None] = mapped_column(String, nullable=True)
    drawing_id: Mapped[str | None] = mapped_column(String, nullable=True)
    actor: Mapped[str] = mapped_column(String)
    action: Mapped[str] = mapped_column(String)
    detail: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class KnowledgeSource(Base):
    """A connected external context source for a site (Outlook, Teams, etc.).
    See MOCKS.md — "connecting" here is a UI flow only, no real OAuth/Graph API."""
    __tablename__ = "knowledge_sources"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_id)
    site_id: Mapped[str] = mapped_column(ForeignKey("sites.id"))
    type: Mapped[str] = mapped_column(String)  # outlook | teams | manual
    display_name: Mapped[str] = mapped_column(String)
    connected_by_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    status: Mapped[str] = mapped_column(String, default="connected")  # connected | disconnected
    connected_at: Mapped[datetime] = mapped_column(DateTime, default=now)

    documents: Mapped[list["KnowledgeDocument"]] = relationship(
        back_populates="source", cascade="all, delete-orphan"
    )


class KnowledgeDocument(Base):
    """A single ingested item (email, Teams message, note) standing in for what
    a real sync would pull. See MOCKS.md for the real-vs-mock boundary."""
    __tablename__ = "knowledge_documents"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_id)
    source_id: Mapped[str] = mapped_column(ForeignKey("knowledge_sources.id"))
    site_id: Mapped[str] = mapped_column(ForeignKey("sites.id"))
    title: Mapped[str] = mapped_column(String)
    author: Mapped[str] = mapped_column(String, default="")
    occurred_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    content: Mapped[str] = mapped_column(Text)
    keywords: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)

    source: Mapped["KnowledgeSource"] = relationship(back_populates="documents")
