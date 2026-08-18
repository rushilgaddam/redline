import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Sparkles, X } from "lucide-react";
import { api } from "../lib/api";
import type { KnowledgeDocument, KnowledgeSource } from "../lib/types";

export function AddDocumentModal({
  source,
  onClose,
  onAdded,
}: {
  source: KnowledgeSource;
  onClose: () => void;
  onAdded: (doc: KnowledgeDocument) => void;
}) {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [content, setContent] = useState("");
  const [keywords, setKeywords] = useState("");
  const [saving, setSaving] = useState(false);

  const isEmail = source.type === "outlook";
  const isTeams = source.type === "teams";

  async function submit() {
    if (!title.trim() || !content.trim()) return;
    setSaving(true);
    try {
      const doc = await api.ingestKnowledgeDocument({
        source_id: source.id,
        title: title.trim(),
        author: author.trim(),
        content: content.trim(),
        keywords: keywords
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean),
      });
      onAdded(doc);
    } finally {
      setSaving(false);
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
          className="glass-panel w-full max-w-lg overflow-hidden rounded-2xl shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <span className="text-[13px] font-semibold text-ink-50">
              Paste {isEmail ? "an email" : isTeams ? "a Teams message" : "a note"} from {source.display_name}
            </span>
            <button onClick={onClose} className="text-ink-400 hover:text-white">
              <X size={15} />
            </button>
          </div>

          <div className="space-y-3 p-4">
            <p className="flex items-start gap-2 rounded-lg border border-signal-blue/20 bg-signal-blue/[0.06] px-3 py-2 text-[11.5px] text-ink-300">
              <Sparkles size={13} className="mt-0.5 shrink-0 text-signal-blue" />
              Standing in for what a real sync would pull automatically — paste real (or representative) content
              here and the AI answer pipeline can cite it.
            </p>
            <div>
              <div className="mb-1 text-[11.5px] font-medium text-ink-300">
                {isEmail ? "Subject" : isTeams ? "Message summary" : "Title"}
              </div>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={isEmail ? "RE: CB-3 nuisance trips" : "Panel B door won't latch"}
                className="w-full rounded-lg border border-ink-600 bg-ink-850 px-3 py-2 text-[13px] text-ink-100 placeholder:text-ink-500 focus:border-signal-teal/50 focus:outline-none"
              />
            </div>
            <div>
              <div className="mb-1 text-[11.5px] font-medium text-ink-300">From</div>
              <input
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Marisol Rivera"
                className="w-full rounded-lg border border-ink-600 bg-ink-850 px-3 py-2 text-[13px] text-ink-100 placeholder:text-ink-500 focus:border-signal-teal/50 focus:outline-none"
              />
            </div>
            <div>
              <div className="mb-1 text-[11.5px] font-medium text-ink-300">Content</div>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={6}
                placeholder="Paste the body text here…"
                className="w-full resize-none rounded-lg border border-ink-600 bg-ink-850 px-3 py-2 text-[13px] text-ink-100 placeholder:text-ink-500 focus:border-signal-teal/50 focus:outline-none"
              />
            </div>
            <div>
              <div className="mb-1 text-[11.5px] font-medium text-ink-300">Keywords (optional, comma-separated)</div>
              <input
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="cb-3, breaker, trip"
                className="w-full rounded-lg border border-ink-600 bg-ink-850 px-3 py-2 text-[13px] text-ink-100 placeholder:text-ink-500 focus:border-signal-teal/50 focus:outline-none"
              />
            </div>
            <button
              disabled={saving || !title.trim() || !content.trim()}
              onClick={submit}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-signal-teal px-4 py-2 text-[13px] font-semibold text-ink-950 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              Add to site knowledge
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
