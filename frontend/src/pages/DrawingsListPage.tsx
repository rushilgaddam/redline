import { useNavigate } from "react-router-dom";
import { AlertCircle, CheckCircle2, PackageCheck, ShieldAlert, UploadCloud } from "lucide-react";
import { motion, type Variants } from "framer-motion";
import { useStore } from "../lib/store";
import { DrawingCardSkeleton } from "../components/Skeleton";

const gridVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.03 } },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.96 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
};

export function DrawingsListPage() {
  const { drawings, flags, userById, loading } = useStore();
  const navigate = useNavigate();

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-ink-700 px-6 py-4">
        <div>
          <h1 className="text-[17px] font-bold text-ink-50">Drawings</h1>
          <p className="text-[12px] text-ink-400">Every drawing under management, with its live flag load.</p>
        </div>
        <motion.button
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => navigate("/drawings/new")}
          className="flex items-center gap-1.5 rounded-lg bg-signal-teal px-3 py-1.5 text-[12.5px] font-semibold text-ink-950 shadow-[var(--shadow-glow-teal)]"
        >
          <UploadCloud size={14} />
          Add drawing
        </motion.button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {loading ? (
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
            {[0, 1, 2, 3].map((i) => (
              <DrawingCardSkeleton key={i} />
            ))}
          </div>
        ) : (
          <motion.div variants={gridVariants} initial="hidden" animate="show" className="grid grid-cols-2 gap-3 xl:grid-cols-3">
            {drawings.map((d) => {
              const dFlags = flags.filter((f) => f.drawing_id === d.id);
              const open = dFlags.filter((f) => f.status !== "resolved").length;
              const author = userById(d.primary_author_id);
              const needsReview = d.confidence_floor_status === "needs_review";
              return (
                <motion.button
                  key={d.id}
                  variants={cardVariants}
                  whileHover={{ y: -3, borderColor: "var(--color-ink-500)" }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate(needsReview ? `/drawings/${d.id}/regions` : `/drawings/${d.id}`)}
                  className="flex flex-col items-start gap-3 rounded-xl border border-ink-700 bg-ink-900/50 p-4 text-left"
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="rounded-md border border-ink-600 bg-ink-850 px-1.5 py-0.5 font-mono text-[10px] text-ink-300">
                      {d.discipline}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {d.status === "closed" && (
                        <span className="flex items-center gap-1 text-[11px] font-medium text-ink-400">
                          <PackageCheck size={12} /> assembled
                        </span>
                      )}
                      {needsReview ? (
                        <span className="flex items-center gap-1 text-[11px] font-medium text-signal-amber">
                          <ShieldAlert size={12} /> needs review
                        </span>
                      ) : open > 0 ? (
                        <span className="flex items-center gap-1 text-[11px] font-medium text-signal-coral">
                          <AlertCircle size={12} /> {open} active
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[11px] font-medium text-signal-teal">
                          <CheckCircle2 size={12} /> clear
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="font-mono text-[13px] font-semibold text-ink-100">
                      {d.drawing_number} <span className="text-ink-500">Rev {d.revision}</span>
                    </div>
                    <div className="mt-0.5 text-[13px] text-ink-300">{d.title}</div>
                  </div>
                  <div className="text-[11px] text-ink-500">Author of record: {author?.name ?? "—"}</div>
                </motion.button>
              );
            })}
          </motion.div>
        )}
      </div>
    </div>
  );
}
