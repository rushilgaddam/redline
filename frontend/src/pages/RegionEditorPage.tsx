import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2, MousePointerSquareDashed, Plus, Trash2 } from "lucide-react";
import clsx from "clsx";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { useStore } from "../lib/store";
import type { DrawingDetail } from "../lib/types";
import { RegionEditorCanvas, type EditableRegion } from "../components/CadViewer/RegionEditorCanvas";

export function RegionEditorPage() {
  const { drawingId } = useParams<{ drawingId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { currentEngineer } = useSession();
  const { refreshDrawings } = useStore();

  const [drawing, setDrawing] = useState<DrawingDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [regions, setRegions] = useState<EditableRegion[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawMode, setDrawMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const warnings = (location.state as { warnings?: string[] } | null)?.warnings ?? [];

  useEffect(() => {
    if (!drawingId) return;
    api
      .drawing(drawingId)
      .then((d) => {
        setDrawing(d);
        setRegions(d.regions.map((r) => ({ ...r })));
      })
      .catch(() => setNotFound(true));
  }, [drawingId]);

  const selected = useMemo(() => regions.find((r) => r.id === selectedId) ?? null, [regions, selectedId]);

  async function save(alsoConfirm: boolean) {
    if (!drawing) return;
    setSaving(true);
    try {
      const updated = await api.updateRegions(drawing.id, regions);
      setDrawing(updated);
      setRegions(updated.regions.map((r) => ({ ...r })));
      if (alsoConfirm && currentEngineer) {
        setConfirming(true);
        const confirmed = await api.confirmDrawing(drawing.id, currentEngineer.id);
        setDrawing(confirmed);
        await refreshDrawings();
        navigate(`/drawings/${drawing.id}`);
      }
    } finally {
      setSaving(false);
      setConfirming(false);
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
          <button onClick={() => navigate("/drawings")} className="rounded-md p-1.5 text-ink-400 hover:bg-ink-800 hover:text-white">
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[14px] font-bold text-ink-50">{drawing.drawing_number}</span>
              <span className="font-mono text-[12px] text-ink-500">Rev {drawing.revision}</span>
              <span className="rounded-md border border-signal-amber/30 bg-signal-amber/10 px-1.5 py-0.5 text-[10px] font-medium text-signal-amber">
                Needs confirmation
              </span>
            </div>
            <div className="text-[12.5px] text-ink-300">{drawing.title} — confirm regions before this goes live</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDrawMode((v) => !v)}
            className={clsx(
              "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition",
              drawMode
                ? "border-signal-teal/40 bg-signal-teal/10 text-signal-teal"
                : "border-ink-700 text-ink-300 hover:bg-ink-800",
            )}
          >
            <Plus size={13} />
            Draw region
          </button>
          <button
            onClick={() => save(false)}
            disabled={saving}
            className="rounded-lg border border-ink-700 px-2.5 py-1.5 text-[12px] font-medium text-ink-300 transition hover:bg-ink-800 disabled:opacity-50"
          >
            {saving && !confirming ? "Saving…" : "Save draft"}
          </button>
          <button
            onClick={() => save(true)}
            disabled={saving || regions.length === 0}
            className="flex items-center gap-1.5 rounded-lg bg-signal-teal px-3 py-1.5 text-[12px] font-semibold text-ink-950 shadow-[var(--shadow-glow-teal)] transition hover:brightness-110 disabled:opacity-40"
          >
            {confirming ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
            Confirm & go live
          </button>
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="flex items-start gap-2 border-b border-signal-amber/20 bg-signal-amber/[0.06] px-5 py-2.5 text-[12px] text-signal-amber">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <div>{warnings.join(" · ")}</div>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1 p-3">
          <RegionEditorCanvas
            layout={drawing.layout}
            regions={regions}
            onChange={setRegions}
            selectedId={selectedId}
            onSelect={setSelectedId}
            drawMode={drawMode}
            onRegionDrawn={() => setDrawMode(false)}
          />
          {drawMode && (
            <div className="pointer-events-none absolute left-1/2 top-6 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-signal-teal/30 bg-ink-900/90 px-3 py-1.5 text-[12px] text-signal-teal backdrop-blur-sm">
              <MousePointerSquareDashed size={13} />
              Click and drag on the drawing to draw a new region
            </div>
          )}
        </div>

        <div className="w-[360px] shrink-0 border-l border-ink-700 bg-ink-900/40">
          <div className="border-b border-ink-700 px-4 py-3.5">
            <div className="text-[13px] font-semibold text-ink-100">
              Regions <span className="text-ink-500">({regions.length})</span>
            </div>
            <div className="text-[11.5px] text-ink-400">
              Drag to move, corner handle to resize. Click a row to edit its name.
            </div>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            {regions.length === 0 && (
              <div className="rounded-lg border border-dashed border-ink-600 px-3 py-6 text-center text-[12px] text-ink-500">
                No regions yet — use "Draw region" to add one, or nothing was auto-detected in this file.
              </div>
            )}
            {regions.map((r) => (
              <div
                key={r.id}
                onClick={() => setSelectedId(r.id)}
                className={clsx(
                  "cursor-pointer rounded-lg border p-2.5 transition",
                  r.id === selectedId ? "border-signal-teal/40 bg-signal-teal/[0.06]" : "border-ink-700 bg-ink-850/50 hover:border-ink-600",
                )}
              >
                <div className="flex items-center gap-2">
                  <input
                    value={r.label}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setRegions(regions.map((x) => (x.id === r.id ? { ...x, label: e.target.value } : x)))}
                    className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1.5 py-1 text-[12.5px] font-medium text-ink-100 hover:border-ink-600 focus:border-signal-teal/40 focus:bg-ink-850 focus:outline-none"
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setRegions(regions.filter((x) => x.id !== r.id));
                      if (selectedId === r.id) setSelectedId(null);
                    }}
                    className="shrink-0 rounded-md p-1 text-ink-500 hover:bg-signal-coral/10 hover:text-signal-coral"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
                <textarea
                  value={r.description}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setRegions(regions.map((x) => (x.id === r.id ? { ...x, description: e.target.value } : x)))}
                  placeholder="What's here — used to ground AI answers"
                  rows={1}
                  className="mt-1 w-full resize-none rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-[11px] text-ink-400 placeholder:text-ink-600 hover:border-ink-600 focus:border-signal-teal/40 focus:bg-ink-850 focus:outline-none"
                />
              </div>
            ))}
          </div>
          {selected && (
            <div className="border-t border-ink-700 px-3 py-2 font-mono text-[10.5px] text-ink-500">
              x {selected.bbox_x.toFixed(1)}% · y {selected.bbox_y.toFixed(1)}% · w {selected.bbox_w.toFixed(1)}% · h{" "}
              {selected.bbox_h.toFixed(1)}%
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
