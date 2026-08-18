import type {
  ConversationItem,
  DrawingDetail,
  DrawingSummary,
  Flag,
  FlagDetail,
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
  }) => req<SmsInboundResult>(`/sms/inbound`, { method: "POST", body: JSON.stringify(payload) }),
};
