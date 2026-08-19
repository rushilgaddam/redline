import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, type Variants } from "framer-motion";
import { Building2, CheckCircle2, FileStack, Users } from "lucide-react";
import { api } from "../lib/api";
import type { SiteSummary } from "../lib/types";

const gridVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.03 } },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.96 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
};

export function ProjectsListPage() {
  const [sites, setSites] = useState<SiteSummary[] | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.siteSummaries().then(setSites);
  }, []);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-ink-700 px-6 py-4">
        <h1 className="text-[17px] font-bold text-ink-50">Projects</h1>
        <p className="text-[12px] text-ink-400">Every site under management and how far along it is.</p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {!sites ? (
          <div className="text-[13px] text-ink-400">Loading…</div>
        ) : (
          <motion.div variants={gridVariants} initial="hidden" animate="show" className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {sites.map((s) => (
              <motion.button
                key={s.id}
                variants={cardVariants}
                whileHover={{ y: -3, borderColor: "var(--color-ink-500)" }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate(`/projects/${s.id}`)}
                className="flex flex-col items-start gap-3 rounded-xl border border-ink-700 bg-ink-900/50 p-4 text-left"
              >
                <div className="flex w-full items-center justify-between">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-signal-blue/10 text-signal-blue">
                    <Building2 size={15} />
                  </span>
                  <span className="flex items-center gap-1 text-[11px] font-medium text-signal-teal">
                    <CheckCircle2 size={12} />
                    {s.resolution_rate}% resolved
                  </span>
                </div>
                <div>
                  <div className="text-[14px] font-semibold text-ink-100">{s.name}</div>
                  <div className="mt-0.5 flex items-center gap-3 text-[11.5px] text-ink-400">
                    <span className="flex items-center gap-1">
                      <FileStack size={11} /> {s.drawing_count} drawing{s.drawing_count === 1 ? "" : "s"}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users size={11} /> {s.collaborator_count}
                    </span>
                  </div>
                </div>
                <div className="w-full">
                  <div className="mb-1 flex items-center justify-between text-[10.5px] text-ink-500">
                    <span>
                      {s.open_flag_count} open · {s.tentative_flag_count} tentative · {s.resolved_flag_count} resolved
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-800">
                    <div className="h-full rounded-full bg-signal-teal" style={{ width: `${s.resolution_rate}%` }} />
                  </div>
                </div>
              </motion.button>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
