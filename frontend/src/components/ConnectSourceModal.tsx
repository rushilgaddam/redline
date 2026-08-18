import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Mail, MessagesSquare, ShieldCheck, StickyNote, X } from "lucide-react";
import clsx from "clsx";
import { api } from "../lib/api";
import type { KnowledgeSource, KnowledgeSourceType } from "../lib/types";

const TYPE_META: Record<KnowledgeSourceType, { label: string; icon: React.ReactNode; placeholder: string; scope: string }> = {
  outlook: {
    label: "Outlook",
    icon: <Mail size={18} />,
    placeholder: "e.g. Marisol Rivera's Outlook",
    scope: "Read access to mail in the selected mailbox",
  },
  teams: {
    label: "Teams",
    icon: <MessagesSquare size={18} />,
    placeholder: "e.g. #line-1-electrical",
    scope: "Read access to messages in the selected channel",
  },
  manual: {
    label: "Manual notes",
    icon: <StickyNote size={18} />,
    placeholder: "e.g. Shift handoff log",
    scope: "No external access — you'll paste in content yourself",
  },
};

export function ConnectSourceModal({
  siteId,
  connectedByUserId,
  onClose,
  onConnected,
}: {
  siteId: string;
  connectedByUserId: string;
  onClose: () => void;
  onConnected: (source: KnowledgeSource) => void;
}) {
  const [type, setType] = useState<KnowledgeSourceType | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [step, setStep] = useState<"pick" | "consent">("pick");
  const [connecting, setConnecting] = useState(false);

  async function authorize() {
    if (!type || !displayName.trim()) return;
    setConnecting(true);
    try {
      const source = await api.connectKnowledgeSource({
        site_id: siteId,
        type,
        display_name: displayName.trim(),
        connected_by_user_id: connectedByUserId,
      });
      onConnected(source);
    } finally {
      setConnecting(false);
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: -10, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.97 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
          className="glass-panel w-full max-w-sm overflow-hidden rounded-2xl shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <span className="text-[13px] font-semibold text-ink-50">
              {step === "pick" ? "Connect a context source" : "Authorize access"}
            </span>
            <button onClick={onClose} className="text-ink-400 hover:text-white">
              <X size={15} />
            </button>
          </div>

          {step === "pick" ? (
            <div className="space-y-3 p-4">
              <div className="grid grid-cols-3 gap-2">
                {(Object.entries(TYPE_META) as [KnowledgeSourceType, typeof TYPE_META.outlook][]).map(([key, meta]) => (
                  <button
                    key={key}
                    onClick={() => setType(key)}
                    className={clsx(
                      "flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-center transition-colors",
                      type === key
                        ? "border-signal-teal/50 bg-signal-teal/10 text-signal-teal"
                        : "border-ink-700 bg-ink-850/60 text-ink-300 hover:border-ink-500",
                    )}
                  >
                    {meta.icon}
                    <span className="text-[11px] font-medium">{meta.label}</span>
                  </button>
                ))}
              </div>
              {type && (
                <div>
                  <div className="mb-1 text-[11.5px] font-medium text-ink-300">Name this source</div>
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder={TYPE_META[type].placeholder}
                    className="w-full rounded-lg border border-ink-600 bg-ink-850 px-3 py-2 text-[13px] text-ink-100 placeholder:text-ink-500 focus:border-signal-teal/50 focus:outline-none"
                  />
                </div>
              )}
              <button
                disabled={!type || !displayName.trim()}
                onClick={() => setStep("consent")}
                className="w-full rounded-lg bg-signal-teal px-4 py-2 text-[13px] font-semibold text-ink-950 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Continue
              </button>
            </div>
          ) : (
            <div className="space-y-4 p-4">
              <div className="flex items-center gap-3 rounded-xl border border-ink-700 bg-ink-850/60 p-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-signal-teal/10 text-signal-teal">
                  {type && TYPE_META[type].icon}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-medium text-ink-100">{displayName}</div>
                  <div className="text-[11px] text-ink-500">{type && TYPE_META[type].label}</div>
                </div>
              </div>
              <div className="flex items-start gap-2 rounded-lg border border-ink-700 bg-ink-900/60 px-3 py-2.5 text-[12px] text-ink-300">
                <ShieldCheck size={15} className="mt-0.5 shrink-0 text-signal-blue" />
                <div>
                  <div className="font-medium text-ink-100">Redline is requesting:</div>
                  {type && <div className="mt-0.5">{TYPE_META[type].scope}</div>}
                  <div className="mt-1.5 text-[10.5px] text-ink-500">
                    Simulated for this prototype — see MOCKS.md. No real account is contacted.
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setStep("pick")}
                  className="flex-1 rounded-lg border border-ink-600 px-4 py-2 text-[13px] font-medium text-ink-300 hover:bg-ink-800"
                >
                  Back
                </button>
                <button
                  onClick={authorize}
                  disabled={connecting}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-signal-teal px-4 py-2 text-[13px] font-semibold text-ink-950 disabled:opacity-60"
                >
                  {connecting ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                  Authorize
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
