import { useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { motion } from "framer-motion";
import { Bot, FileText, MessageSquare, PlugZap, ShieldCheck, User as UserIcon, UserPlus } from "lucide-react";
import { api } from "../lib/api";
import type { AuditEvent } from "../lib/types";
import { timeAgo } from "../lib/format";

const ACTION_META: Record<string, { icon: React.ReactNode; label: string; agent: boolean }> = {
  ingested: { icon: <FileText size={13} />, label: "ingested a drawing", agent: false },
  regions_confirmed: { icon: <ShieldCheck size={13} />, label: "confirmed regions", agent: false },
  replied: { icon: <MessageSquare size={13} />, label: "replied", agent: false },
  resolved: { icon: <ShieldCheck size={13} />, label: "resolved a flag", agent: false },
  confirmed_resolved: { icon: <ShieldCheck size={13} />, label: "confirmed the fix in the field", agent: false },
  drawing_closed: { icon: <ShieldCheck size={13} />, label: "closed out the drawing", agent: false },
  drawing_reopened: { icon: <FileText size={13} />, label: "reopened the drawing", agent: false },
  flag_created: { icon: <Bot size={13} />, label: "raised a new flag", agent: true },
  finding_created: { icon: <Bot size={13} />, label: "flagged a CAD QA finding", agent: true },
  ocr_resolution_failed: { icon: <Bot size={13} />, label: "couldn't resolve a title-block photo", agent: true },
  knowledge_source_connected: { icon: <PlugZap size={13} />, label: "connected a source", agent: false },
  knowledge_scope_granted: { icon: <PlugZap size={13} />, label: "granted access", agent: false },
  knowledge_document_ingested: { icon: <FileText size={13} />, label: "added a knowledge item", agent: false },
  user_registered: { icon: <UserPlus size={13} />, label: "joined this project", agent: false },
  user_joined_project: { icon: <UserPlus size={13} />, label: "was added to this project", agent: false },
  avatar_updated: { icon: <UserIcon size={13} />, label: "updated their profile photo", agent: false },
};

export function SiteActivityTab() {
  const { siteId } = useOutletContext<{ siteId: string }>();
  const [events, setEvents] = useState<AuditEvent[] | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.siteActivity(siteId, 100).then(setEvents);
  }, [siteId]);

  if (!events) return <div className="text-[13px] text-ink-400">Loading…</div>;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-xl border border-ink-700 bg-ink-900/50">
        <div className="border-b border-ink-700 px-4 py-3">
          <div className="text-[13px] font-semibold text-ink-100">Activity</div>
          <div className="text-[11.5px] text-ink-400">Everything that's happened on this site's drawings and flags.</div>
        </div>
        {events.length === 0 ? (
          <div className="px-4 py-8 text-center text-[12.5px] text-ink-500">No activity yet.</div>
        ) : (
          <div className="divide-y divide-ink-800">
            {events.map((e, i) => {
              const meta = ACTION_META[e.action] ?? { icon: <UserIcon size={13} />, label: e.action, agent: false };
              return (
                <motion.button
                  key={e.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i, 10) * 0.03 }}
                  onClick={() => e.drawing_id && navigate(`/drawings/${e.drawing_id}`)}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-ink-850/60"
                >
                  <span
                    className={
                      meta.agent
                        ? "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-signal-blue/10 text-signal-blue"
                        : "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink-800 text-ink-300"
                    }
                  >
                    {meta.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] text-ink-100">
                      <span className="font-medium">{e.actor}</span> {meta.label}
                    </div>
                    {e.detail && <div className="mt-0.5 truncate text-[11.5px] text-ink-400">{e.detail}</div>}
                  </div>
                  <span className="shrink-0 text-[10.5px] text-ink-500">{timeAgo(e.created_at)}</span>
                </motion.button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
