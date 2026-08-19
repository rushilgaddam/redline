import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, HardHat, Loader2, Wrench, X } from "lucide-react";
import { api } from "../lib/api";
import type { User } from "../lib/types";

type FormRole = "engineer" | "reviewer" | "technician";
const ROLE_LABEL: Record<FormRole, string> = { engineer: "Engineer", reviewer: "Reviewer", technician: "Technician" };

export function AddCollaboratorModal({
  siteId,
  onClose,
  onAdded,
}: {
  siteId: string;
  onClose: () => void;
  onAdded: (u: User) => void;
}) {
  const [role, setRole] = useState<FormRole>("engineer");
  const [name, setName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [discipline, setDiscipline] = useState("");
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isTechnician = role === "technician";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !identifier.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const u = await api.register({
        role,
        name,
        email: isTechnician ? undefined : identifier,
        phone: isTechnician ? identifier : undefined,
        discipline: discipline || undefined,
        title: title || undefined,
        site_ids: [siteId],
      });
      onAdded(u);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add collaborator");
    } finally {
      setSubmitting(false);
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
            <span className="text-[13px] font-semibold text-ink-50">Add collaborator</span>
            <button onClick={onClose} className="text-ink-400 hover:text-white">
              <X size={15} />
            </button>
          </div>

          <form onSubmit={submit} className="space-y-3 p-4">
            <div className="grid grid-cols-3 gap-1.5">
              {(["engineer", "reviewer", "technician"] as FormRole[]).map((r) => (
                <button
                  type="button"
                  key={r}
                  onClick={() => {
                    setRole(r);
                    setIdentifier("");
                  }}
                  className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-center transition-colors ${
                    role === r ? "border-signal-blue/50 bg-signal-blue/10 text-signal-blue" : "border-ink-700 bg-ink-850/40 text-ink-400 hover:border-ink-500"
                  }`}
                >
                  {r === "technician" ? <Wrench size={14} /> : <HardHat size={14} />}
                  <span className="text-[10.5px] font-medium">{ROLE_LABEL[r]}</span>
                </button>
              ))}
            </div>

            <div>
              <div className="mb-1 text-[11.5px] font-medium text-ink-300">Full name</div>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jordan Lee"
                className="w-full rounded-lg border border-ink-600 bg-ink-850 px-3 py-2 text-[13px] text-ink-100 placeholder:text-ink-500 focus:border-signal-blue/50 focus:outline-none"
              />
            </div>
            <div>
              <div className="mb-1 text-[11.5px] font-medium text-ink-300">{isTechnician ? "Phone number" : "Work email"}</div>
              <input
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={isTechnician ? "555-234-1122" : "you@company.com"}
                type={isTechnician ? "tel" : "email"}
                className="w-full rounded-lg border border-ink-600 bg-ink-850 px-3 py-2 text-[13px] text-ink-100 placeholder:text-ink-500 focus:border-signal-blue/50 focus:outline-none"
              />
            </div>
            {!isTechnician && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="mb-1 text-[11.5px] font-medium text-ink-300">Discipline</div>
                  <input
                    value={discipline}
                    onChange={(e) => setDiscipline(e.target.value)}
                    placeholder="Electrical"
                    className="w-full rounded-lg border border-ink-600 bg-ink-850 px-2.5 py-2 text-[12.5px] text-ink-100 placeholder:text-ink-500 focus:border-signal-blue/50 focus:outline-none"
                  />
                </div>
                <div>
                  <div className="mb-1 text-[11.5px] font-medium text-ink-300">Title</div>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Engineer II"
                    className="w-full rounded-lg border border-ink-600 bg-ink-850 px-2.5 py-2 text-[12.5px] text-ink-100 placeholder:text-ink-500 focus:border-signal-blue/50 focus:outline-none"
                  />
                </div>
              </div>
            )}
            {error && (
              <div className="flex items-start gap-1.5 text-[11.5px] text-signal-coral">
                <AlertCircle size={13} className="mt-0.5 shrink-0" />
                {error}
              </div>
            )}
            <p className="text-[10.5px] text-ink-500">
              If this email or phone already has an account, they'll just be added to this project.
            </p>
            <button
              type="submit"
              disabled={submitting || !name.trim() || !identifier.trim()}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-signal-teal px-4 py-2.5 text-[13px] font-semibold text-ink-950 disabled:opacity-50"
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              Add to project
            </button>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
