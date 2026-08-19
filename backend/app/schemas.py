from datetime import datetime

from pydantic import BaseModel, ConfigDict


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    role: str
    name: str
    phone: str | None = None
    email: str | None = None
    discipline: str | None = None
    title: str | None = None
    avatar_color: str
    out_of_office: bool
    site_ids: list[str] = []


class RegionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    label: str
    description: str
    bbox_x: float
    bbox_y: float
    bbox_w: float
    bbox_h: float


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    sender: str
    sender_name: str | None
    text: str
    photo_ref: str | None
    created_at: datetime


class FlagOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    drawing_id: str
    region_id: str | None
    x: float
    y: float
    status: str
    source: str
    technician_id: str | None
    photo_ref: str | None
    note: str
    ai_confidence: float | None
    ai_reasoning: str | None
    ai_diagnosis: str | None
    knowledge_reuse_flag_id: str | None
    site_knowledge_document_id: str | None
    routed_to_user_id: str | None
    created_at: datetime
    resolved_at: datetime | None


class FlagDetailOut(FlagOut):
    messages: list[MessageOut]


class DrawingSummaryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    site_id: str
    drawing_number: str
    revision: str
    title: str
    discipline: str
    primary_author_id: str
    confidence_floor_status: str
    status: str
    closed_at: datetime | None


class DrawingDetailOut(DrawingSummaryOut):
    context_block: str
    revision_notes: str
    layout: dict
    cad_qa_scanned: bool
    regions: list[RegionOut]
    flags: list[FlagOut]


class SmsInboundIn(BaseModel):
    technician_id: str
    text: str
    photo_ref: str | None = None
    asset_tag_drawing_id: str | None = None
    drawing_id_override: str | None = None
    site_id: str | None = None
    title_block_photo_drawing_id: str | None = None


class SmsInboundOut(BaseModel):
    flag: FlagOut | None
    reply_text: str
    candidates: list[DrawingSummaryOut] = []


class ReplyIn(BaseModel):
    text: str
    actor_user_id: str


class CadQaRunOut(BaseModel):
    findings: list[FlagOut]


class RegionIn(BaseModel):
    id: str | None = None
    label: str
    description: str = ""
    bbox_x: float
    bbox_y: float
    bbox_w: float
    bbox_h: float


class RegionsUpdateIn(BaseModel):
    regions: list[RegionIn]


class IngestWarningsOut(BaseModel):
    drawing: DrawingDetailOut
    warnings: list[str]


class KnowledgeSourceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    site_id: str
    type: str
    display_name: str
    connected_by_user_id: str
    status: str
    connected_at: datetime


class KnowledgeSourceCreateIn(BaseModel):
    site_id: str
    type: str
    display_name: str
    connected_by_user_id: str


class KnowledgeDocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    source_id: str
    site_id: str
    title: str
    author: str
    occurred_at: datetime | None
    content: str
    keywords: list[str]
    created_at: datetime


class KnowledgeDocumentCreateIn(BaseModel):
    source_id: str
    title: str
    author: str = ""
    occurred_at: datetime | None = None
    content: str
    keywords: list[str] = []
