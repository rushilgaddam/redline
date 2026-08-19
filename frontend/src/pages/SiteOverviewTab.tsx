import { useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Clock, FileStack } from "lucide-react";
import { api } from "../lib/api";
import type { SiteOverview } from "../lib/types";
import { Avatar } from "../components/Avatar";
import { AssistantChat } from "../components/AssistantChat";

function StatCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string | number; tone: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-ink-700 bg-ink-900/50 p-4">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: `${tone}1a`, color: tone }}>
        {icon}
      </span>
      <div>
        <div className="text-[18px] font-bold text-ink-50">{value}</div>
        <div className="text-[11px] text-ink-400">{label}</div>
      </div>
    </div>
  );
}

export function SiteOverviewTab() {
  const { siteId } = useOutletContext<{ siteId: string }>();
  const [overview, setOverview] = useState<SiteOverview | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.siteOverview(siteId).then(setOverview);
  }, [siteId]);

  if (!overview) return <div className="text-[13px] text-ink-400">Loading…</div>;
  const { site, workstreams } = overview;

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
      <div className="space-y-5 xl:col-span-2">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard icon={<FileStack size={16} />} label="Drawings" value={site.drawing_count} tone="#5c9dff" />
          <StatCard icon={<AlertCircle size={16} />} label="Open flags" value={site.open_flag_count} tone="#ff5c72" />
          <StatCard icon={<Clock size={16} />} label="Tentative" value={site.tentative_flag_count} tone="#ffb35c" />
          <StatCard icon={<CheckCircle2 size={16} />} label="Resolved" value={site.resolved_flag_count} tone="#3ee6c4" />
        </div>

        <div className="rounded-xl border border-ink-700 bg-ink-900/50">
          <div className="border-b border-ink-700 px-4 py-3">
            <div className="text-[13px] font-semibold text-ink-100">Workstreams</div>
            <div className="text-[11.5px] text-ink-400">Progress broken down by discipline for this site.</div>
          </div>
          <div className="divide-y divide-ink-800">
            {workstreams.length === 0 && (
              <div className="px-4 py-6 text-center text-[12.5px] text-ink-500">No drawings ingested for this site yet.</div>
            )}
            {workstreams.map((w, i) => {
              const total = w.open_flag_count + w.resolved_flag_count;
              const rate = total ? Math.round((100 * w.resolved_flag_count) / total) : 0;
              return (
                <motion.div
                  key={w.discipline}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium text-ink-100">{w.discipline}</div>
                    <div className="text-[11px] text-ink-400">
                      {w.drawing_count} drawing{w.drawing_count === 1 ? "" : "s"} · {w.open_flag_count} open
                    </div>
                  </div>
                  <div className="hidden w-32 sm:block">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-800">
                      <div className="h-full rounded-full bg-signal-teal" style={{ width: `${rate}%` }} />
                    </div>
                  </div>
                  {w.owner_name && (
                    <button
                      onClick={() => w.owner_id && navigate(`/inbox`)}
                      className="flex items-center gap-1.5"
                      title={w.owner_name}
                    >
                      <Avatar name={w.owner_name} color={w.owner_avatar_color ?? "#5c9dff"} src={w.owner_avatar_url} size={26} />
                    </button>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="xl:col-span-1">
        <AssistantChat siteId={siteId} />
      </div>
    </div>
  );
}
