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
  out_of_office: boolean;
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
  routed_to_user_id: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface FlagDetail extends Flag {
  messages: Message[];
}

export interface DrawingSummary {
  id: string;
  drawing_number: string;
  revision: string;
  title: string;
  discipline: string;
  primary_author_id: string;
  confidence_floor_status: string;
}

export type Shape = {
  type: "rect" | "line" | "circle" | "path" | "text" | "polyline";
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
  status: FlagStatus;
  source: FlagSource;
  sender: MessageSender;
  text: string;
  photo_ref: string | null;
  created_at: string;
}

export interface Site {
  id: string;
  name: string;
  org_id: string;
}
