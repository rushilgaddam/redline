import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, BookOpen, ChevronRight, Loader2, PackageCheck, ScanLine, ShieldAlert, Sparkles, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import clsx from "clsx";
import { api } from "../lib/api";
import { useStore } from "../lib/store";
import { useSession } from "../lib/session";
import type { DrawingDetail, Flag } from "../lib/types";
import { CadViewer, type CadViewerHandle } from "../components/CadViewer/CadViewer";
import { FlagThreadPanel } from "../components/FlagThread/FlagThreadPanel";
import { StatusBadge } from "../components/StatusBadge";
import { Avatar } from "../components/Avatar";
import { timeAgo } from "../lib/format";

export function DrawingPage() {
  const { drawingId } = useParams<{ drawingId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { userById, flags: allFlags, upsertFlag } = useStore();
  const { currentEngineer } = useSession();
  const navigate = useNavigate();

  const [drawing, setDrawing] = useState<DrawingDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [selectedFlagId, setSelectedFlagId] = useState<string | null>(null);
  const [showContext, setShowContext] = useState(false);
  const [scanning, setScanning] = useState(false);
  const viewerRef = useRef<CadViewerHandle>(null);

  useEffect(() => {
    if (!drawingId) return;
    setDrawing(null);
    setNotFound(false);
    api
      .drawing(drawingId)
      .then((d) => {
        setDrawing(d);
        const focus = searchParams.get("focus");
        if (focus) setSelectedFlagId(focus);
      })
      .catch(() => setNotFound(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawingId]);

  const flags = useMemo(
    () => (drawingId ? allFlags.filter((f) => f.drawing_id === drawingId) : []),
    [allFlags, drawingId],
  );

  const sortedFlags = useMemo(() => {
    const order = { open: 0, answered: 1, resolved: 2 };
    return [...flags].sort((a, b) => order[a.status] - order[b.status] || (a.created_at < b.created_at ? -1 : 1));
  }, [flags]);

  const selectedFlag = flags.find((f) => f.id === selectedFlagId) ?? null;
  const author = drawing ? userById(drawing.primary_author_id) : undefined;

  function selectFlag(flag: Flag | null) {
    setSelectedFlagId(flag?.id ?? null);
    if (flag) viewerRef.current?.focusOnFlag(flag);
    const next = new URLSearchParams(searchParams);
    if (flag) next.set("focus", flag.id);
    else next.delete("focus");
    setSearchParams(next, { replace: true });
  }

  async function runScan() {
    if (!drawing) return;
    setScanning(true);
    try {
      await api.runCadQa(drawing.id);
      const refreshed = await api.drawing(drawing.id);
      setDrawing(refreshed);
    } finally {
      setTimeout(() => setScanning(false), 1400);
    }
  }

  if (notFound) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <div className="text-[15px] font-semibold text-ink-100">Drawing not found</div>
        <p className="max-w-sm text-[12.5px] text-ink-400">
          This drawing may have been removed, or you're looking at a stale link from before a data reset.
        </p>
        <button
          onClick={() => navigate("/drawings")}
          className="rounded-lg border border-ink-600 px-3 py-1.5 text-[12.5px] font-medium text-ink-200 hover:bg-ink-800"
        >
          Back to Drawings
        </button>
      </div>
    );
  }

  if (!drawing) {
    return (
      <div className="flex h-full items-center justify-center text-ink-400">
        <Loader2 className="animate-spin" size={20} />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-ink-700 px-5 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="rounded-md p-1.5 text-ink-400 hover:bg-ink-800 hover:text-white">
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[14px] font-bold text-ink-50">{drawing.drawing_number}</span>
              <span className="font-mono text-[12px] text-ink-500">Rev {drawing.revision}</span>
              <span className="rounded-md border border-ink-600 bg-ink-850 px-1.5 py-0.5 font-mono text-[10px] text-ink-300">
                {drawing.discipline}
              </span>
              {drawing.status === "closed" && (
                <span className="flex items-center gap-1 rounded-md border border-ink-600 bg-ink-800 px-1.5 py-0.5 text-[10px] font-medium text-ink-300">
                  <PackageCheck size={10} /> Assembly complete
                </span>
              )}
            </div>
            <div className="text-[12.5px] text-ink-300">{drawing.title}</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowContext((v) => !v)}
            className={clsx(
              "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition",
              showContext ? "border-signal-blue/40 bg-signal-blue/10 text-signal-blue" : "border-ink-700 text-ink-300 hover:bg-ink-800",
            )}
          >
            <BookOpen size={13} />
            Context
          </button>
          {!drawing.cad_qa_scanned && (
            <button
              onClick={runScan}
              disabled={scanning}
              className="flex items-center gap-1.5 rounded-lg border border-signal-teal/30 bg-signal-teal/10 px-2.5 py-1.5 text-[12px] font-semibold text-signal-teal transition hover:bg-signal-teal/15 disabled:opacity-50"
            >
              {scanning ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              {scanning ? "Scanning…" : "Run CAD-QA scan"}
            </button>
          )}
          {author && (
            <div className="ml-1 flex items-center gap-2 rounded-lg border border-ink-700 bg-ink-850 px-2 py-1">
              <Avatar name={author.name} color={author.avatar_color} src={author.avatar_url} size={22} />
              <div className="pr-1 text-[11.5px] leading-tight text-ink-300">
                <div className="font-medium text-ink-100">{author.name}</div>
                <div className="text-ink-500">author of record</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {drawing.confidence_floor_status === "needs_review" && (
        <div className="flex items-center justify-between gap-3 border-b border-signal-amber/20 bg-signal-amber/[0.06] px-5 py-2.5 text-[12.5px] text-signal-amber">
          <div className="flex items-center gap-2">
            <ShieldAlert size={14} />
            Regions haven't been confirmed yet — technician questions about this drawing route straight to you as a
            direct escalation, with no tentative AI answer, until it's confirmed.
          </div>
          <button
            onClick={() => navigate(`/drawings/${drawing.id}/regions`)}
            className="shrink-0 rounded-md border border-signal-amber/40 px-2.5 py-1 font-medium text-signal-amber transition hover:bg-signal-amber/10"
          >
            Confirm regions
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1 p-3">
          <CadViewer
            ref={viewerRef}
            layout={drawing.layout}
            regions={drawing.regions}
            flags={flags}
            selectedFlagId={selectedFlagId}
            onSelectFlag={selectFlag}
            scanning={scanning}
          />
          {showContext && (
            <div className="absolute left-6 top-6 max-w-md rounded-xl border border-signal-blue/25 bg-ink-900/95 p-4 shadow-2xl backdrop-blur-md">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-signal-blue">
                  Grounding context block
                </span>
                <button onClick={() => setShowContext(false)} className="text-ink-400 hover:text-white">
                  <X size={14} />
                </button>
              </div>
              <p className="text-[12.5px] leading-relaxed text-ink-200">{drawing.context_block}</p>
              <p className="mt-2 border-t border-ink-700 pt-2 text-[11px] italic leading-relaxed text-ink-400">
                {drawing.revision_notes}
              </p>
            </div>
          )}
          <div className="absolute right-6 top-6 flex flex-col gap-1.5 rounded-lg border border-ink-700 bg-ink-850/85 px-2.5 py-2 font-mono text-[10.5px] text-ink-400 backdrop-blur-sm">
            <Legend color="#dc2626" label="open" />
            <Legend color="#d97706" label="tentative" />
            <Legend color="#059669" label="resolved" />
          </div>
        </div>

        <div className="w-[380px] shrink-0 overflow-hidden border-l border-ink-700 bg-ink-900/40">
          <AnimatePresence mode="wait" initial={false}>
          {selectedFlag ? (
            <motion.div
              key="thread"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="h-full"
            >
            <FlagThreadPanel
              flag={selectedFlag}
              region={drawing.regions.find((r) => r.id === selectedFlag.region_id) ?? null}
              drawingLabel={`${drawing.drawing_number} Rev ${drawing.revision}`}
              currentEngineer={currentEngineer}
              onClose={() => selectFlag(null)}
              onUpdated={(f) => {
                upsertFlag(f);
              }}
            />
            </motion.div>
          ) : (
            <motion.div
              key="list"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="flex h-full flex-col">
              <div className="border-b border-ink-700 px-4 py-3.5">
                <div className="text-[13px] font-semibold text-ink-100">
                  Flags <span className="text-ink-500">({flags.length})</span>
                </div>
                <div className="text-[11.5px] text-ink-400">Every pin on this drawing, oldest active first.</div>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                {sortedFlags.length === 0 && (
                  <div className="px-3 py-8 text-center text-[12.5px] text-ink-500">
                    No flags yet. This drawing is clean.
                  </div>
                )}
                {sortedFlags.map((f) => {
                  const region = drawing.regions.find((r) => r.id === f.region_id);
                  return (
                    <button
                      key={f.id}
                      onClick={() => selectFlag(f)}
                      className="mb-1.5 flex w-full items-start gap-2.5 rounded-lg border border-transparent px-2.5 py-2.5 text-left transition hover:border-ink-600 hover:bg-ink-850"
                    >
                      <div className="mt-0.5 shrink-0">
                        {f.source === "cad_qa" ? (
                          <ScanLine size={14} className="text-ink-400" />
                        ) : (
                          <div
                            className="h-2 w-2 rounded-full"
                            style={{
                              background: f.status === "open" ? "#dc2626" : f.status === "answered" ? "#d97706" : "#059669",
                            }}
                          />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-[12px] font-medium text-ink-100">
                            {region?.label ?? "Unmapped"}
                          </span>
                          <StatusBadge status={f.status} />
                        </div>
                        <p className="mt-0.5 truncate text-[12px] text-ink-400">{f.note}</p>
                        <p className="mt-0.5 text-[10.5px] text-ink-500">{timeAgo(f.created_at)}</p>
                      </div>
                      <ChevronRight size={13} className="mt-1 shrink-0 text-ink-600" />
                    </button>
                  );
                })}
              </div>

              <div className="border-t border-ink-700 p-3">
                <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-400">
                  Named regions ({drawing.regions.length})
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {drawing.regions.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => viewerRef.current?.focusOnRegion(r.id)}
                      className="rounded-md border border-ink-700 bg-ink-850 px-2 py-1 text-[10.5px] text-ink-300 transition hover:border-signal-teal/40 hover:text-signal-teal"
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {label}
    </div>
  );
}
