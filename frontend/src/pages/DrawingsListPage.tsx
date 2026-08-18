import { useNavigate } from "react-router-dom";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useStore } from "../lib/store";

export function DrawingsListPage() {
  const { drawings, flags, userById, loading } = useStore();
  const navigate = useNavigate();

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-ink-700 px-6 py-4">
        <h1 className="text-[17px] font-bold text-ink-50">Drawings</h1>
        <p className="text-[12px] text-ink-400">Every drawing under management, with its live flag load.</p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {loading ? (
          <div className="text-[13px] text-ink-400">Loading…</div>
        ) : (
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
            {drawings.map((d) => {
              const dFlags = flags.filter((f) => f.drawing_id === d.id);
              const open = dFlags.filter((f) => f.status !== "resolved").length;
              const author = userById(d.primary_author_id);
              return (
                <button
                  key={d.id}
                  onClick={() => navigate(`/drawings/${d.id}`)}
                  className="flex flex-col items-start gap-3 rounded-xl border border-ink-700 bg-ink-900/50 p-4 text-left transition hover:border-ink-500 hover:bg-ink-850"
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="rounded-md border border-ink-600 bg-ink-850 px-1.5 py-0.5 font-mono text-[10px] text-ink-300">
                      {d.discipline}
                    </span>
                    {open > 0 ? (
                      <span className="flex items-center gap-1 text-[11px] font-medium text-signal-coral">
                        <AlertCircle size={12} /> {open} active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] font-medium text-signal-teal">
                        <CheckCircle2 size={12} /> clear
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="font-mono text-[13px] font-semibold text-ink-100">
                      {d.drawing_number} <span className="text-ink-500">Rev {d.revision}</span>
                    </div>
                    <div className="mt-0.5 text-[13px] text-ink-300">{d.title}</div>
                  </div>
                  <div className="text-[11px] text-ink-500">Author of record: {author?.name ?? "—"}</div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
