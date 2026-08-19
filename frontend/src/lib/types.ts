export type Role = "technician" | "engineer" | "reviewer" | "admin";
export type FlagStatus = "open" | "answered" | "resolved";
export type FlagSource = "sms" | "cad_qa";
export type MessageSender = "technician" | "ai" | "engineer" | "system";

export interface User {
  id: string;
  role: Role;
  name: string;
  phone: string | null;
  email: string | null;
  discipline: string | null;
  title: string | null;
  avatar_color: string;
  avatar_url: string | null;
  out_of_office: boolean;
  site_ids: string[];
}

export interface Region {
  id: string;
  label: string;
  description: string;
  bbox_x: number;
  bbox_y: number;
  bbox_w: number;
  bbox_h: number;
}

export interface Message {
  id: string;
  sender: MessageSender;
  sender_name: string | null;
  text: string;
  photo_ref: string | null;
  created_at: string;
}

export interface Flag {
  id: string;
  drawing_id: string;
  region_id: string | null;
  x: number;
  y: number;
  status: FlagStatus;
  source: FlagSource;
  technician_id: string | null;
  photo_ref: string | null;
  note: string;
  ai_confidence: number | null;
  ai_reasoning: string | null;
  ai_diagnosis: string | null;
  knowledge_reuse_flag_id: string | null;
  site_knowledge_document_id: string | null;
  routed_to_user_id: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface FlagDetail extends Flag {
  messages: Message[];
}

export interface DrawingSummary {
  id: string;
  site_id: string;
  drawing_number: string;
  revision: string;
  title: string;
  discipline: string;
  primary_author_id: string;
  confidence_floor_status: string;
  status: "active" | "closed";
  closed_at: string | null;
}

export type Shape = {
  type: "rect" | "line" | "circle" | "path" | "text" | "polyline" | "image";
  class: string;
  [key: string]: unknown;
};

export interface DrawingLayout {
  viewBox: [number, number, number, number];
  shapes: Shape[];
}

export interface DrawingDetail extends DrawingSummary {
  context_block: string;
  revision_notes: string;
  layout: DrawingLayout;
  cad_qa_scanned: boolean;
  regions: Region[];
  flags: Flag[];
}

export interface SmsInboundResult {
  flag: Flag | null;
  reply_text: string;
  candidates: DrawingSummary[];
}

export interface ConversationItem {
  flag_id: string;
  drawing_id: string;
  drawing_number: string | null;
  drawing_title: string | null;
  region_label: string | null;
  status: FlagStatus;
  source: FlagSource;
  sender: MessageSender;
  sender_name: string | null;
  text: string;
  photo_ref: string | null;
  created_at: string;
}

export interface IngestResult {
  drawing: DrawingDetail;
  warnings: string[];
}

export interface Site {
  id: string;
  name: string;
  org_id: string;
}

export interface SiteSummary extends Site {
  drawing_count: number;
  active_drawing_count: number;
  open_flag_count: number;
  tentative_flag_count: number;
  resolved_flag_count: number;
  resolution_rate: number;
  collaborator_count: number;
}

export interface Workstream {
  discipline: string;
  drawing_count: number;
  open_flag_count: number;
  resolved_flag_count: number;
  owner_id: string | null;
  owner_name: string | null;
  owner_avatar_color: string | null;
  owner_avatar_url: string | null;
}

export interface SiteOverview {
  site: SiteSummary;
  workstreams: Workstream[];
}

export interface AuditEvent {
  id: string;
  flag_id: string | null;
  drawing_id: string | null;
  site_id: string | null;
  actor: string;
  action: string;
  detail: string;
  created_at: string;
}

export type KnowledgeSourceType =
  | "outlook"
  | "teams"
  | "google_drive"
  | "gmail"
  | "google_sheets"
  | "google_calendar"
  | "manual";

export interface KnowledgeSource {
  id: string;
  site_id: string;
  type: KnowledgeSourceType;
  display_name: string;
  connected_by_user_id: string;
  status: "connected" | "disconnected";
  scope_kind: string;
  scope_items: string[];
  connected_at: string;
}

export interface AssistantAnswer {
  text: string;
  flag_ids: string[];
  drawing_ids: string[];
}

export interface KnowledgeDocument {
  id: string;
  source_id: string;
  site_id: string;
  title: string;
  author: string;
  occurred_at: string | null;
  content: string;
  keywords: string[];
  created_at: string;
}
