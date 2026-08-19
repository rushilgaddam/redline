import { useEffect, useRef, useState } from "react";
import { AlertTriangle, BrainCircuit, Camera, CheckCircle2, History, Loader2, ScanLine, Send, X } from "lucide-react";
import type { Flag, FlagDetail, KnowledgeDocument, Region, User } from "../../lib/types";
import { api } from "../../lib/api";
import { timeAgo } from "../../lib/format";
import { StatusBadge } from "../StatusBadge";
import { ConfidenceMeter } from "../ConfidenceMeter";
import { PhotoCard } from "../PhotoCard";
import { MessageBubble } from "../MessageBubble";
import { Avatar } from "../Avatar";

export function FlagThreadPanel({
  flag,
  region,
  drawingLabel,
  currentEngineer,
  onClose,
  onUpdated,
}: {
  flag: Flag;
  region: Region | null;
  drawingLabel: string;
  currentEngineer: User | null;
  onClose: () => void;
  onUpdated: (f: Flag) => void;
}) {
  const [detail, setDetail] = useState<FlagDetail | null>(null);
  const [reuseFlag, setReuseFlag] = useState<FlagDetail | null>(null);
  const [siteDoc, setSiteDoc] = useState<KnowledgeDocument | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDetail(null);
    setReplyText("");
    api.flag(flag.id).then(setDetail).catch(() => setDetail(null));
    if (flag.knowledge_reuse_flag_id) {
      api.flag(flag.knowledge_reuse_flag_id).then(setReuseFlag).catch(() => setReuseFlag(null));
    } else {
      setReuseFlag(null);
    }
    if (flag.site_knowledge_document_id) {
      api.knowledgeDocument(flag.site_knowledge_document_id).then(setSiteDoc).catch(() => setSiteDoc(null));
    } else {
      setSiteDoc(null);
    }
  }, [flag.id, flag.knowledge_reuse_flag_id, flag.site_knowledge_document_id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [detail?.messages.length]);

  async function send(resolve: boolean) {
    if (!currentEngineer) return;
    if (!replyText.trim() && !resolve) return;
    setSending(true);
    try {
      let updated: FlagDetail;
      if (replyText.trim()) {
        updated = await api.reply(flag.id, replyText.trim(), currentEngineer.id);
        if (resolve) updated = await api.resolve(flag.id, undefined, currentEngineer.id);
      } else {
        updated = await api.resolve(flag.id, undefined, currentEngineer.id);
      }
      setDetail(updated);
      setReplyText("");
      onUpdated(updated);
    } finally {
      setSending(false);
    }
  }

  const isCadQa = flag.source === "cad_qa";

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div className="flex items-start justify-between gap-3 border-b border-ink-700 px-4 py-3.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wide text-ink-400">
            {isCadQa ? <ScanLine size={12} /> : <Camera size={12} />}
            {isCadQa ? "CAD-QA finding" : "Technician SMS"}
            <span className="text-ink-600">·</span>
            {drawingLabel}
          </div>
          <div className="mt-0.5 truncate text-[15px] font-semibold text-ink-50">
            {region?.label ?? "Unmapped location"}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={flag.status} pulse />
          <button onClick={onClose} className="rounded-md p-1 text-ink-400 hover:bg-ink-700 hover:text-white">
            <X size={16} />
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {!isCadQa && (
          <div className="flex items-center gap-2 text-[11px] text-ink-400">
            <span>{timeAgo(flag.created_at)}</span>
            {flag.routed_to_user_id && (
              <>
                <span className="text-ink-600">·</span>
                <span>routed for review</span>
              </>
            )}
          </div>
        )}

        {region && (
          <p className="rounded-lg border border-ink-700 bg-ink-850/60 px-3 py-2 text-[12.5px] leading-relaxed text-ink-300">
            {region.description}
          </p>
        )}

        {(flag.ai_confidence !== null || isCadQa) && (
          <div className="rounded-xl border border-ink-700 bg-ink-850/60 p-3">
            <div className="flex items-center gap-3">
              <ConfidenceMeter value={flag.ai_confidence ?? 0} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-300">
                  {isCadQa ? (
                    <>
                      <ScanLine size={12} className="text-signal-blue" />
                      Background finding — needs confirmation
                    </>
                  ) : flag.ai_diagnosis ? (
                    <>
                      <CheckCircle2 size={12} className="text-signal-amber" />
                      Tentative match
                    </>
                  ) : (
                    <>
                      <AlertTriangle size={12} className="text-signal-coral" />
                      Escalated — not confident
                    </>
                  )}
                </div>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-300">{flag.ai_reasoning}</p>
              </div>
            </div>
            {flag.ai_diagnosis && (
              <div className="mt-2.5 rounded-lg border border-signal-amber/25 bg-signal-amber/[0.06] px-3 py-2 text-[12.5px] leading-relaxed text-ink-100">
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-signal-amber">
                  Draft answer sent to technician — unconfirmed
                </div>
                {flag.ai_diagnosis}
              </div>
            )}
          </div>
        )}

        {reuseFlag && (
          <div className="flex gap-2 rounded-lg border border-signal-blue/25 bg-signal-blue/[0.06] px-3 py-2 text-[12px] leading-relaxed text-ink-200">
            <History size={14} className="mt-0.5 shrink-0 text-signal-blue" />
            <div>
              <span className="font-semibold text-signal-blue">Similar case resolved before: </span>
              this was also surfaced to the technician directly, in addition to routing here.
              <div className="mt-1 italic text-ink-300">"{reuseFlag.note}"</div>
            </div>
          </div>
        )}

        {siteDoc && (
          <div className="flex gap-2 rounded-lg border border-signal-violet/25 bg-signal-violet/[0.06] px-3 py-2 text-[12px] leading-relaxed text-ink-200">
            <BrainCircuit size={14} className="mt-0.5 shrink-0 text-signal-violet" />
            <div className="min-w-0">
              <span className="font-semibold text-signal-violet">Grounded in site knowledge: </span>
              <span className="font-medium text-ink-100">{siteDoc.title}</span>
              {siteDoc.author && <span className="text-ink-400"> — {siteDoc.author}</span>}
              <div className="mt-1 text-ink-300">{siteDoc.content}</div>
            </div>
          </div>
        )}

        {flag.photo_ref && (
          <div>
            <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-400">Field photo</div>
            <PhotoCard photoRef={flag.photo_ref} size="md" />
          </div>
        )}

        <div>
          <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-ink-400">Thread</div>
          {!detail ? (
            <div className="flex items-center gap-2 py-6 text-ink-400">
              <Loader2 size={14} className="animate-spin" /> Loading thread…
            </div>
          ) : (
            <div className="space-y-3">
              {detail.messages.map((m) => (
                <MessageBubble key={m.id} message={m} />
              ))}
            </div>
          )}
        </div>
      </div>

      {flag.status !== "resolved" ? (
        <div className="border-t border-ink-700 bg-ink-900/60 p-3">
          <div className="flex items-center gap-2 mb-2 text-[11px] text-ink-400">
            {currentEngineer && <Avatar name={currentEngineer.name} color={currentEngineer.avatar_color} src={currentEngineer.avatar_url} size={18} />}
            Replying as {currentEngineer?.name ?? "—"} — delivered as an SMS to the technician
          </div>
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Type the real answer…"
            rows={2}
            className="w-full resize-none rounded-lg border border-ink-600 bg-ink-850 px-3 py-2 text-[13px] text-ink-100 placeholder:text-ink-500 focus:border-signal-teal/50 focus:outline-none"
          />
          <div className="mt-2 flex items-center justify-end gap-2">
            <button
              disabled={sending || !replyText.trim()}
              onClick={() => send(false)}
              className="rounded-lg border border-ink-600 px-3 py-1.5 text-[12.5px] font-medium text-ink-200 transition hover:bg-ink-700 disabled:opacity-40"
            >
              Send reply
            </button>
            <button
              disabled={sending || (!replyText.trim() && isCadQa)}
              onClick={() => send(true)}
              className="flex items-center gap-1.5 rounded-lg bg-signal-teal px-3 py-1.5 text-[12.5px] font-semibold text-ink-950 shadow-[var(--shadow-glow-teal)] transition hover:brightness-110 disabled:opacity-40"
            >
              {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              {replyText.trim() ? "Send & resolve" : "Mark resolved"}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 border-t border-ink-700 bg-signal-teal/[0.05] px-4 py-3 text-[12.5px] text-signal-teal">
          <CheckCircle2 size={14} />
          Resolved {flag.resolved_at ? timeAgo(flag.resolved_at) : ""}
        </div>
      )}
    </div>
  );
}
