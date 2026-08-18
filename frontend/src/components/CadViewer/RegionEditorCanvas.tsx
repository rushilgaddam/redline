import { useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import clsx from "clsx";
import type { DrawingLayout } from "../../lib/types";
import { usePanZoom } from "./usePanZoom";
import { ShapeDefs, ShapeLayer } from "./ShapeLayer";

export interface EditableRegion {
  id: string;
  label: string;
  description: string;
  bbox_x: number;
  bbox_y: number;
  bbox_w: number;
  bbox_h: number;
}

interface DragState {
  kind: "move" | "resize" | "draw";
  regionId?: string;
  startX: number;
  startY: number;
  orig: { x: number; y: number; w: number; h: number };
}

const MIN_SIZE = 2.5;

export function RegionEditorCanvas({
  layout,
  regions,
  onChange,
  selectedId,
  onSelect,
  drawMode,
  onRegionDrawn,
}: {
  layout: DrawingLayout;
  regions: EditableRegion[];
  onChange: (regions: EditableRegion[]) => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  drawMode: boolean;
  onRegionDrawn: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [, , VBw, VBh] = layout.viewBox;
  const { transform, isPanning, onWheel, onPointerDown, onPointerMove, onPointerUp, fit, zoomBy } = usePanZoom(
    containerRef,
    { w: VBw, h: VBh },
  );
  const [drag, setDrag] = useState<DragState | null>(null);
  const [drawRect, setDrawRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const px = (pctX: number) => transform.x + (pctX / 100) * VBw * transform.k;
  const py = (pctY: number) => transform.y + (pctY / 100) * VBh * transform.k;
  const toPctX = (clientPx: number) => (clientPx / (VBw * transform.k)) * 100;
  const toPctY = (clientPx: number) => (clientPx / (VBh * transform.k)) * 100;

  function updateRegion(id: string, patch: Partial<EditableRegion>) {
    onChange(regions.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function handleCanvasPointerDown(e: React.PointerEvent) {
    if (!drawMode) {
      onPointerDown(e);
      return;
    }
    const rect = containerRef.current!.getBoundingClientRect();
    const startX = e.clientX - rect.left;
    const startY = e.clientY - rect.top;
    (e.target as Element).setPointerCapture(e.pointerId);
    setDrag({
      kind: "draw",
      startX,
      startY,
      orig: { x: toPctX(startX - transform.x), y: toPctY(startY - transform.y), w: 0, h: 0 },
    });
  }

  function handleCanvasPointerMove(e: React.PointerEvent) {
    if (!drag) {
      onPointerMove(e);
      return;
    }
    const rect = containerRef.current!.getBoundingClientRect();
    const curX = e.clientX - rect.left;
    const curY = e.clientY - rect.top;
    const dxPct = toPctX(curX - drag.startX);
    const dyPct = toPctY(curY - drag.startY);

    if (drag.kind === "draw") {
      const x = Math.min(drag.orig.x, drag.orig.x + dxPct);
      const y = Math.min(drag.orig.y, drag.orig.y + dyPct);
      setDrawRect({ x, y, w: Math.abs(dxPct), h: Math.abs(dyPct) });
    } else if (drag.kind === "move" && drag.regionId) {
      const maxX = 100 - drag.orig.w;
      const maxY = 100 - drag.orig.h;
      updateRegion(drag.regionId, {
        bbox_x: Math.max(0, Math.min(maxX, drag.orig.x + dxPct)),
        bbox_y: Math.max(0, Math.min(maxY, drag.orig.y + dyPct)),
      });
    } else if (drag.kind === "resize" && drag.regionId) {
      const region = regions.find((r) => r.id === drag.regionId);
      const maxW = 100 - (region?.bbox_x ?? 0);
      const maxH = 100 - (region?.bbox_y ?? 0);
      updateRegion(drag.regionId, {
        bbox_w: Math.max(MIN_SIZE, Math.min(maxW, drag.orig.w + dxPct)),
        bbox_h: Math.max(MIN_SIZE, Math.min(maxH, drag.orig.h + dyPct)),
      });
    }
  }

  function handleCanvasPointerUp(e: React.PointerEvent) {
    if (drag?.kind === "draw") {
      if (drawRect && drawRect.w > 1 && drawRect.h > 1) {
        const newRegion: EditableRegion = {
          id: `new-${crypto.randomUUID()}`,
          label: `New region ${regions.length + 1}`,
          description: "",
          bbox_x: drawRect.x,
          bbox_y: drawRect.y,
          bbox_w: drawRect.w,
          bbox_h: drawRect.h,
        };
        onChange([...regions, newRegion]);
        onSelect(newRegion.id);
      }
      setDrawRect(null);
      setDrag(null);
      onRegionDrawn();
      return;
    }
    setDrag(null);
    onPointerUp();
    void e;
  }

  return (
    <div
      ref={containerRef}
      className={clsx(
        "relative h-full w-full overflow-hidden rounded-xl border border-ink-700 bg-ink-950 select-none",
        drawMode ? "cursor-crosshair" : isPanning ? "cursor-grabbing" : "cursor-grab",
      )}
      onWheel={onWheel}
      onPointerDown={handleCanvasPointerDown}
      onPointerMove={handleCanvasPointerMove}
      onPointerUp={handleCanvasPointerUp}
      onPointerLeave={handleCanvasPointerUp}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.028) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.028) 1px, transparent 1px)",
          backgroundSize: `${24 * transform.k}px ${24 * transform.k}px`,
          backgroundPosition: `${transform.x}px ${transform.y}px`,
        }}
      />

      <svg
        style={{ position: "absolute", left: transform.x, top: transform.y }}
        width={VBw * transform.k}
        height={VBh * transform.k}
        viewBox={`0 0 ${VBw} ${VBh}`}
      >
        <ShapeDefs />
        <ShapeLayer shapes={layout.shapes} />
      </svg>

      {regions.map((region) => {
        const rx = px(region.bbox_x);
        const ry = py(region.bbox_y);
        const rw = (region.bbox_w / 100) * VBw * transform.k;
        const rh = (region.bbox_h / 100) * VBh * transform.k;
        const isSelected = region.id === selectedId;
        return (
          <div
            key={region.id}
            onPointerDown={(e) => {
              if (drawMode) return;
              e.stopPropagation();
              (e.target as Element).setPointerCapture(e.pointerId);
              onSelect(region.id);
              setDrag({
                kind: "move",
                regionId: region.id,
                startX: e.clientX,
                startY: e.clientY,
                orig: { x: region.bbox_x, y: region.bbox_y, w: region.bbox_w, h: region.bbox_h },
              });
            }}
            className="absolute rounded-md"
            style={{
              left: rx,
              top: ry,
              width: rw,
              height: rh,
              cursor: drawMode ? "crosshair" : "move",
              border: isSelected ? "1.5px solid var(--color-signal-teal)" : "1.5px dashed var(--color-signal-blue)",
              background: isSelected ? "rgba(45,230,196,0.10)" : "rgba(94,200,255,0.06)",
              boxShadow: isSelected ? "0 0 16px rgba(45,230,196,0.25)" : undefined,
            }}
          >
            <div
              className={clsx(
                "pointer-events-none absolute -top-6 left-0 whitespace-nowrap rounded-md border px-1.5 py-0.5 font-mono text-[10px]",
                isSelected
                  ? "border-signal-teal/40 bg-signal-teal/15 text-signal-teal"
                  : "border-signal-blue/30 bg-ink-850/90 text-signal-blue",
              )}
            >
              {region.label}
            </div>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onChange(regions.filter((r) => r.id !== region.id));
                if (isSelected) onSelect(null);
              }}
              className="absolute -right-2.5 -top-2.5 flex h-5 w-5 items-center justify-center rounded-full border border-signal-coral/50 bg-ink-900 text-signal-coral transition hover:bg-signal-coral/20"
            >
              <Trash2 size={10} />
            </button>
            <div
              onPointerDown={(e) => {
                e.stopPropagation();
                (e.target as Element).setPointerCapture(e.pointerId);
                onSelect(region.id);
                setDrag({
                  kind: "resize",
                  regionId: region.id,
                  startX: e.clientX,
                  startY: e.clientY,
                  orig: { x: region.bbox_x, y: region.bbox_y, w: region.bbox_w, h: region.bbox_h },
                });
              }}
              className="absolute -bottom-1.5 -right-1.5 h-3 w-3 cursor-nwse-resize rounded-sm border border-ink-950"
              style={{ background: "var(--color-signal-teal)" }}
            />
          </div>
        );
      })}

      {drawRect && (
        <div
          className="pointer-events-none absolute rounded-md border-2 border-dashed border-signal-teal bg-signal-teal/10"
          style={{ left: px(drawRect.x), top: py(drawRect.y), width: (drawRect.w / 100) * VBw * transform.k, height: (drawRect.h / 100) * VBh * transform.k }}
        />
      )}

      <div className="absolute bottom-4 right-4 flex flex-col gap-1.5 rounded-lg border border-ink-700 bg-ink-850/90 p-1 backdrop-blur-sm">
        <button className="rounded-md p-1.5 text-ink-200 transition hover:bg-ink-700 hover:text-white" onClick={() => zoomBy(1.3)}>
          +
        </button>
        <button className="rounded-md p-1.5 text-ink-200 transition hover:bg-ink-700 hover:text-white" onClick={() => zoomBy(1 / 1.3)}>
          −
        </button>
        <button className="rounded-md p-1.5 text-ink-200 transition hover:bg-ink-700 hover:text-white" onClick={() => fit()}>
          ⤢
        </button>
      </div>
    </div>
  );
}
