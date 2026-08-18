import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, CheckCircle2, Clock, PartyPopper, Camera, ScanLine } from "lucide-react";
import { motion, type Variants } from "framer-motion";
import { useSession } from "../lib/session";
import { useStore } from "../lib/store";
import { LiveDot } from "../components/layout/AppShell";
import { StatusBadge } from "../components/StatusBadge";
import { CountUp } from "../components/CountUp";
import { InboxCardSkeleton } from "../components/Skeleton";
import { timeAgo } from "../lib/format";
import type { Flag } from "../lib/types";

function isToday(iso: string) {
  const d = new Date(iso.endsWith("Z") ? iso : `${iso}Z`);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

const listVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.055, delayChildren: 0.03 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.38, ease: [0.16, 1, 0.3, 1] } },
};

export function InboxPage() {
  const { currentEngineer } = useSession();
  const { drawings, flags, connected, loading } = useStore();
  const navigate = useNavigate();

  const scopedFlags = useMemo(() => {
    if (!currentEngineer) return [];
    if (currentEngineer.role === "reviewer") return flags;
    return flags.filter((f) => f.routed_to_user_id === currentEngineer.id);
  }, [flags, currentEngineer]);

  const counts = useMemo(
    () => ({
      open: scopedFlags.filter((f) => f.status === "open").length,
      answered: scopedFlags.filter((f) => f.status === "answered").length,
      resolvedToday: scopedFlags.filter((f) => f.status === "resolved" && f.resolved_at && isToday(f.resolved_at))
        .length,
    }),
    [scopedFlags],
  );

  const groups = useMemo(() => {
    const byDrawing = new Map<string, Flag[]>();
    for (const f of scopedFlags) {
      if (f.status === "resolved") continue;
      const list = byDrawing.get(f.drawing_id) ?? [];
      list.push(f);
      byDrawing.set(f.drawing_id, list);
    }
    return [...byDrawing.entries()]
      .map(([drawingId, fs]) => ({
        drawing: drawings.find((d) => d.id === drawingId),
        flags: fs.sort((a, b) => (a.created_at < b.created_at ? -1 : 1)),
      }))
      .filter((g) => g.drawing)
      .sort((a, b) => (a.flags[0].created_at < b.flags[0].created_at ? -1 : 1));
  }, [scopedFlags, drawings]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-ink-700 px-6 py-4">
        <div>
          <h1 className="text-[17px] font-bold text-ink-50">Inbox</h1>
          <p className="text-[12px] text-ink-400">
            {currentEngineer?.role === "reviewer"
              ? "All flags across your sites, oldest unanswered first."
              : "Drawings needing your review, oldest unanswered first."}
          </p>
        </div>
        <LiveDot connected={connected} />
      </div>

      <div className="flex gap-3 border-b border-ink-700 px-6 py-3">
        <StatChip icon={<AlertCircle size={13} />} label="Open" value={counts.open} tone="coral" />
        <StatChip icon={<Clock size={13} />} label="Tentative" value={counts.answered} tone="amber" />
        <StatChip icon={<CheckCircle2 size={13} />} label="Resolved today" value={counts.resolvedToday} tone="teal" />
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <InboxCardSkeleton key={i} />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center justify-center gap-3 py-24 text-center"
          >
            <PartyPopper size={28} className="text-signal-teal" />
            <div className="text-[15px] font-semibold text-ink-100">All caught up</div>
            <p className="max-w-sm text-[12.5px] text-ink-400">
              Nothing waiting on you right now. New flags land here the moment a technician texts, or the CAD-QA
              agent finds something.
            </p>
          </motion.div>
        ) : (
          <motion.div variants={listVariants} initial="hidden" animate="show" className="space-y-3">
            {groups.map((g) => (
              <motion.button
                key={g.drawing!.id}
                variants={itemVariants}
                whileHover={{ y: -2, borderColor: "var(--color-ink-500)" }}
                whileTap={{ scale: 0.995 }}
                onClick={() => navigate(`/drawings/${g.drawing!.id}?focus=${g.flags[0].id}`)}
                className="flex w-full items-start gap-4 rounded-xl border border-ink-700 bg-ink-900/50 p-4 text-left"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-ink-600 bg-ink-850 font-mono text-[10px] font-semibold text-ink-300">
                  {g.drawing!.discipline.slice(0, 3).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[12.5px] font-semibold text-ink-100">
                      {g.drawing!.drawing_number}
                    </span>
                    <span className="font-mono text-[11px] text-ink-500">Rev {g.drawing!.revision}</span>
                    <span className="truncate text-[12.5px] text-ink-300">{g.drawing!.title}</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-ink-400">
                    <Clock size={11} />
                    oldest waiting {timeAgo(g.flags[0].created_at)}
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {g.flags.slice(0, 4).map((f) => (
                      <span
                        key={f.id}
                        className="flex items-center gap-1 rounded-md border border-ink-700 bg-ink-850 px-1.5 py-0.5 text-[10.5px] text-ink-300"
                      >
                        {f.source === "sms" ? <Camera size={9} /> : <ScanLine size={9} />}
                        {f.note.slice(0, 34)}
                        {f.note.length > 34 ? "…" : ""}
                      </span>
                    ))}
                    {g.flags.length > 4 && (
                      <span className="rounded-md px-1.5 py-0.5 text-[10.5px] text-ink-500">
                        +{g.flags.length - 4} more
                      </span>
                    )}
                  </div>
                </div>
                <StatusBadge status={g.flags[0].status} pulse />
              </motion.button>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}

function StatChip({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "coral" | "amber" | "teal";
}) {
  const toneClass = {
    coral: "text-signal-coral bg-signal-coral/10 border-signal-coral/20",
    amber: "text-signal-amber bg-signal-amber/10 border-signal-amber/20",
    teal: "text-signal-teal bg-signal-teal/10 border-signal-teal/20",
  }[tone];
  return (
    <div className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 ${toneClass}`}>
      {icon}
      <CountUp value={value} className="font-mono text-[13px] font-semibold mono-num" />
      <span className="text-[11.5px] text-ink-400">{label}</span>
    </div>
  );
}
