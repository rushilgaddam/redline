import type {
  ConversationItem,
  DrawingDetail,
  DrawingSummary,
  Flag,
  FlagDetail,
  IngestResult,
  KnowledgeDocument,
  KnowledgeSource,
  KnowledgeSourceType,
  Region,
  Site,
  SmsInboundResult,
  User,
} from "./types";

const BASE = "/api";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  users: (role?: string) => req<User[]>(`/users${role ? `?role=${role}` : ""}`),
  user: (id: string) => req<User>(`/users/${id}`),
  sites: () => req<Site[]>(`/users/sites/all`),

  drawings: (siteId?: string) => req<DrawingSummary[]>(`/drawings${siteId ? `?site_id=${siteId}` : ""}`),
  drawing: (id: string) => req<DrawingDetail>(`/drawings/${id}`),
  runCadQa: (id: string) => req<{ findings: Flag[] }>(`/drawings/${id}/cad-qa-scan`, { method: "POST" }),
  closeDrawing: async (id: string, technicianId: string): Promise<DrawingSummary> => {
    const body = new FormData();
    body.append("technician_id", technicianId);
    const res = await fetch(`${BASE}/drawings/${id}/close`, { method: "POST", body });
    if (!res.ok) {
      const detail = await res.json().catch(() => null);
      throw new Error(detail?.detail ?? `${res.status} ${res.statusText}`);
    }
    return res.json();
  },

  ingestDrawing: async (form: {
    file: File;
    drawing_number: string;
    revision: string;
    title: string;
    discipline: string;
    site_id: string;
    primary_author_id: string;
    context_block: string;
  }): Promise<IngestResult> => {
    const body = new FormData();
    for (const [k, v] of Object.entries(form)) body.append(k, v as string | Blob);
    const res = await fetch(`${BASE}/drawings/ingest`, { method: "POST", body });
    if (!res.ok) {
      const detail = await res.json().catch(() => null);
      throw new Error(detail?.detail ?? `${res.status} ${res.statusText}`);
    }
    return res.json();
  },
  updateRegions: (
    drawingId: string,
    regions: Pick<Region, "id" | "label" | "description" | "bbox_x" | "bbox_y" | "bbox_w" | "bbox_h">[],
  ) =>
    req<DrawingDetail>(`/drawings/${drawingId}/regions`, {
      method: "PUT",
      body: JSON.stringify({
        regions: regions.map((r) => ({ ...r, id: r.id.startsWith("new-") ? null : r.id })),
      }),
    }),
  confirmDrawing: async (drawingId: string, actorUserId: string): Promise<DrawingDetail> => {
    const body = new FormData();
    body.append("actor_user_id", actorUserId);
    const res = await fetch(`${BASE}/drawings/${drawingId}/confirm`, { method: "POST", body });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json();
  },

  flags: (params: Record<string, string | undefined> = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][],
    ).toString();
    return req<Flag[]>(`/flags${qs ? `?${qs}` : ""}`);
  },
  flag: (id: string) => req<FlagDetail>(`/flags/${id}`),
  reply: (id: string, text: string, actor_user_id: string) =>
    req<FlagDetail>(`/flags/${id}/reply`, { method: "POST", body: JSON.stringify({ text, actor_user_id }) }),
  resolve: (id: string, text: string | undefined, actor_user_id: string) =>
    req<FlagDetail>(`/flags/${id}/resolve`, { method: "POST", body: JSON.stringify({ text: text ?? "", actor_user_id }) }),
  technicianConfirm: (id: string) => req<FlagDetail>(`/flags/${id}/technician-confirm`, { method: "POST" }),

  technicianThread: (technicianId: string) => req<Flag[]>(`/sms/thread/${technicianId}`),
  conversation: (technicianId: string) => req<ConversationItem[]>(`/sms/conversation/${technicianId}`),
  smsInbound: (payload: {
    technician_id: string;
    text: string;
    photo_ref?: string | null;
    asset_tag_drawing_id?: string | null;
    drawing_id_override?: string | null;
    site_id?: string | null;
  }) => req<SmsInboundResult>(`/sms/inbound`, { method: "POST", body: JSON.stringify(payload) }),

  knowledgeSources: (siteId?: string) =>
    req<KnowledgeSource[]>(`/knowledge/sources${siteId ? `?site_id=${siteId}` : ""}`),
  connectKnowledgeSource: (payload: {
    site_id: string;
    type: KnowledgeSourceType;
    display_name: string;
    connected_by_user_id: string;
  }) => req<KnowledgeSource>(`/knowledge/sources`, { method: "POST", body: JSON.stringify(payload) }),
  disconnectKnowledgeSource: (id: string) =>
    req<KnowledgeSource>(`/knowledge/sources/${id}/disconnect`, { method: "POST" }),
  knowledgeDocuments: (params: { siteId?: string; sourceId?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.siteId) qs.set("site_id", params.siteId);
    if (params.sourceId) qs.set("source_id", params.sourceId);
    const s = qs.toString();
    return req<KnowledgeDocument[]>(`/knowledge/documents${s ? `?${s}` : ""}`);
  },
  ingestKnowledgeDocument: (payload: {
    source_id: string;
    title: string;
    author?: string;
    occurred_at?: string | null;
    content: string;
    keywords?: string[];
  }) => req<KnowledgeDocument>(`/knowledge/documents`, { method: "POST", body: JSON.stringify(payload) }),
  deleteKnowledgeDocument: (id: string) => req<{ ok: boolean }>(`/knowledge/documents/${id}`, { method: "DELETE" }),
  knowledgeDocument: (id: string) => req<KnowledgeDocument>(`/knowledge/documents/${id}`),
};
