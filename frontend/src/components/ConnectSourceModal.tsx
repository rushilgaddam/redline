import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Plus, ShieldCheck, X } from "lucide-react";
import clsx from "clsx";
import { api } from "../lib/api";
import { SOURCE_TYPES, SOURCE_TYPE_MAP } from "../lib/knowledgeSourceTypes";
import type { KnowledgeSource, KnowledgeSourceType } from "../lib/types";

type Step = "pick" | "scope" | "consent";

export function ConnectSourceModal({
  siteId,
  connectedByUserId,
  initialType,
  onClose,
  onConnected,
}: {
  siteId: string;
  connectedByUserId: string;
  initialType?: KnowledgeSourceType;
  onClose: () => void;
  onConnected: (source: KnowledgeSource) => void;
}) {
  const [type, setType] = useState<KnowledgeSourceType | null>(initialType ?? null);
  const [displayName, setDisplayName] = useState("");
  const [step, setStep] = useState<Step>(initialType ? "scope" : "pick");
  const [scopeInput, setScopeInput] = useState("");
  const [scopeItems, setScopeItems] = useState<string[]>([]);
  const [connecting, setConnecting] = useState(false);

  const meta = type ? SOURCE_TYPE_MAP[type] : null;
  const needsScope = type && type !== "manual";

  function addScopeItem() {
    const value = scopeInput.trim();
    if (!value || !meta) return;
    const item = `${meta.scopePrefix}: ${value}`;
    if (!scopeItems.includes(item)) setScopeItems((prev) => [...prev, item]);
    setScopeInput("");
  }

  async function authorize() {
    if (!type || !meta) return;
    const name = displayName.trim() || meta.namePlaceholder.replace(/^e\.g\.\s*/i, "");
    setConnecting(true);
    try {
      const source = await api.connectKnowledgeSource({
        site_id: siteId,
        type,
        display_name: name,
        connected_by_user_id: connectedByUserId,
        scope_kind: meta.scopeKind,
        scope_items: scopeItems,
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
          <div className="flex items-center justify-between border-b border-ink-700 px-4 py-3">
            <span className="text-[13px] font-semibold text-ink-50">
              {step === "pick" ? "Connect a context source" : step === "scope" ? "Grant access" : "Confirm access"}
            </span>
            <button onClick={onClose} className="text-ink-400 hover:text-white">
              <X size={15} />
            </button>
          </div>

          {step === "pick" && (
            <div className="space-y-3 p-4">
              <div className="grid grid-cols-3 gap-2">
                {SOURCE_TYPES.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setType(t.key)}
                    className={clsx(
                      "flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-center transition-colors",
                      type === t.key
                        ? "border-signal-teal/50 bg-signal-teal/10"
                        : "border-ink-700 bg-ink-850/60 hover:border-ink-500",
                    )}
                  >
                    <span
                      className="flex h-7 w-7 items-center justify-center rounded-md"
                      style={{ background: t.bg, color: t.color }}
                    >
                      {t.icon}
                    </span>
                    <span className="text-[10.5px] font-medium text-ink-200">{t.label}</span>
                  </button>
                ))}
              </div>
              {meta && (
                <div>
                  <div className="mb-1 text-[11.5px] font-medium text-ink-300">Name this source</div>
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder={meta.namePlaceholder}
                    className="w-full rounded-lg border border-ink-600 bg-ink-850 px-3 py-2 text-[13px] text-ink-100 placeholder:text-ink-500 focus:border-signal-teal/50 focus:outline-none"
                  />
                </div>
              )}
              <button
                disabled={!type}
                onClick={() => setStep(needsScope ? "scope" : "consent")}
                className="w-full rounded-lg bg-signal-teal px-4 py-2 text-[13px] font-semibold text-ink-950 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Continue
              </button>
            </div>
          )}

          {step === "scope" && meta && (
            <div className="space-y-3 p-4">
              {initialType && (
                <div className="flex items-center gap-2 rounded-lg border border-ink-700 bg-ink-850/60 p-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md" style={{ background: meta.bg, color: meta.color }}>
                    {meta.icon}
                  </span>
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder={meta.namePlaceholder}
                    className="min-w-0 flex-1 bg-transparent text-[13px] text-ink-100 placeholder:text-ink-500 focus:outline-none"
                  />
                </div>
              )}
              <p className="text-[12px] leading-relaxed text-ink-400">{meta.scopeHelp}</p>
              <div className="flex gap-1.5">
                <div className="flex flex-1 items-center rounded-lg border border-ink-600 bg-ink-850 pl-3 text-[13px] text-ink-100 focus-within:border-signal-teal/50">
                  <span className="shrink-0 text-ink-500">{meta.scopePrefix}:</span>
                  <input
                    value={scopeInput}
                    onChange={(e) => setScopeInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addScopeItem();
                      }
                    }}
                    placeholder={meta.scopePlaceholder}
                    className="min-w-0 flex-1 bg-transparent px-2 py-2 placeholder:text-ink-500 focus:outline-none"
                  />
                </div>
                <button
                  onClick={addScopeItem}
                  disabled={!scopeInput.trim()}
                  className="flex shrink-0 items-center justify-center rounded-lg border border-ink-600 px-3 text-ink-300 hover:bg-ink-800 disabled:opacity-40"
                >
                  <Plus size={15} />
                </button>
              </div>
              {scopeItems.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {scopeItems.map((item) => (
                    <span
                      key={item}
                      className="flex items-center gap-1 rounded-full border border-signal-teal/30 bg-signal-teal/10 px-2.5 py-1 text-[11.5px] text-signal-teal"
                    >
                      {item}
                      <button onClick={() => setScopeItems((prev) => prev.filter((i) => i !== item))} className="text-signal-teal/70 hover:text-signal-teal">
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                {!initialType && (
                  <button
                    onClick={() => setStep("pick")}
                    className="flex-1 rounded-lg border border-ink-600 px-4 py-2 text-[13px] font-medium text-ink-300 hover:bg-ink-800"
                  >
                    Back
                  </button>
                )}
                <button
                  onClick={() => setStep("consent")}
                  disabled={scopeItems.length === 0}
                  className="flex-1 rounded-lg bg-signal-teal px-4 py-2 text-[13px] font-semibold text-ink-950 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {step === "consent" && meta && (
            <div className="space-y-4 p-4">
              <div className="flex items-center gap-3 rounded-xl border border-ink-700 bg-ink-850/60 p-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: meta.bg, color: meta.color }}>
                  {meta.icon}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-medium text-ink-100">{displayName.trim() || meta.namePlaceholder.replace(/^e\.g\.\s*/i, "")}</div>
                  <div className="text-[11px] text-ink-500">{meta.label}</div>
                </div>
              </div>
              <div className="flex items-start gap-2 rounded-lg border border-ink-700 bg-ink-900/60 px-3 py-2.5 text-[12px] text-ink-300">
                <ShieldCheck size={15} className="mt-0.5 shrink-0 text-signal-blue" />
                <div className="min-w-0">
                  <div className="font-medium text-ink-100">Redline can only read:</div>
                  {scopeItems.length > 0 ? (
                    <ul className="mt-1 space-y-0.5">
                      {scopeItems.map((item) => (
                        <li key={item} className="truncate">
                          • {item}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="mt-0.5">{meta.scopeHelp}</div>
                  )}
                  <div className="mt-1.5 text-[10.5px] text-ink-500">
                    Simulated for this prototype — see MOCKS.md. No real account is contacted.
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setStep(needsScope ? "scope" : "pick")}
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
