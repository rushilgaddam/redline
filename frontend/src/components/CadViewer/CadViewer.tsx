import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Camera, Minus, Plus, ScanLine, Scan } from "lucide-react";
import { motion } from "framer-motion";
import clsx from "clsx";
import type { DrawingLayout, Flag, Region } from "../../lib/types";
import { usePanZoom } from "./usePanZoom";
import { ShapeDefs, ShapeLayer } from "./ShapeLayer";

export interface CadViewerHandle {
  focusOnRegion: (regionId: string) => void;
  focusOnFlag: (flag: Flag) => void;
  resetView: () => void;
}

const STATUS_COLOR: Record<Flag["status"], string> = {
  open: "#ff5c72",
  answered: "#ffb454",
  resolved: "#2de6c4",
};

interface Props {
  layout: DrawingLayout;
  regions: Region[];
  flags: Flag[];
  selectedFlagId?: string | null;
  onSelectFlag?: (flag: Flag) => void;
  scanning?: boolean;
}

export const CadViewer = forwardRef<CadViewerHandle, Props>(function CadViewer(
  { layout, regions, flags, selectedFlagId, onSelectFlag, scanning },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [, , VBw, VBh] = layout.viewBox;
  const { transform, isPanning, onWheel, onPointerDown, onPointerMove, onPointerUp, fit, zoomBy, focusOn } =
    usePanZoom(containerRef, { w: VBw, h: VBh });

  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);
  const [hoveredPin, setHoveredPin] = useState<string | null>(null);

  const selectedFlag = useMemo(() => flags.find((f) => f.id === selectedFlagId) ?? null, [flags, selectedFlagId]);

  useImperativeHandle(ref, () => ({
    focusOnRegion(regionId) {
      const region = regions.find((r) => r.id === regionId);
      if (!region) return;
      const cx = ((region.bbox_x + region.bbox_w / 2) / 100) * VBw;
      const cy = ((region.bbox_y + region.bbox_h / 2) / 100) * VBh;
      focusOn(cx, cy, 2.1);
    },
    focusOnFlag(flag) {
      focusOn((flag.x / 100) * VBw, (flag.y / 100) * VBh, 2.4);
    },
    resetView() {
      fit();
    },
  }));

  const regionsWithFlagCounts = useMemo(() => {
    const counts = new Map<string, { open: number; total: number }>();
    for (const f of flags) {
      if (!f.region_id) continue;
      const entry = counts.get(f.region_id) ?? { open: 0, total: 0 };
      entry.total += 1;
      if (f.status !== "resolved") entry.open += 1;
      counts.set(f.region_id, entry);
    }
    return counts;
  }, [flags]);

  const px = (pctX: number) => transform.x + (pctX / 100) * VBw * transform.k;
  const py = (pctY: number) => transform.y + (pctY / 100) * VBh * transform.k;

  return (
    <div
      ref={containerRef}
      className={clsx(
        "relative h-full w-full overflow-hidden rounded-xl border border-ink-700 bg-ink-950 select-none",
        isPanning ? "cursor-grabbing" : "cursor-grab",
      )}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      {/* infinite grid backdrop, synced to pan/zoom */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.028) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.028) 1px, transparent 1px)",
          backgroundSize: `${24 * transform.k}px ${24 * transform.k}px`,
          backgroundPosition: `${transform.x}px ${transform.y}px`,
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(ellipse at 50% 40%, transparent 40%, rgba(5,7,10,0.85) 100%)",
        }}
      />

      {scanning && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="scanline-sweep absolute inset-x-0 h-24" />
        </div>
      )}

      <svg
        style={{ position: "absolute", left: transform.x, top: transform.y }}
        width={VBw * transform.k}
        height={VBh * transform.k}
        viewBox={`0 0 ${VBw} ${VBh}`}
      >
        <ShapeDefs />
        <ShapeLayer shapes={layout.shapes} />
      </svg>

      {/* region hover/selection overlays */}
      {regions.map((region) => {
        const rx = px(region.bbox_x);
        const ry = py(region.bbox_y);
        const rw = (region.bbox_w / 100) * VBw * transform.k;
        const rh = (region.bbox_h / 100) * VBh * transform.k;
        const isHovered = hoveredRegion === region.id;
        const isSelected = selectedFlag?.region_id === region.id;
        const counts = regionsWithFlagCounts.get(region.id);
        const active = isHovered || isSelected;
        return (
          <div
            key={region.id}
            className="absolute rounded-md transition-[border-color,box-shadow] duration-150"
            style={{
              left: rx,
              top: ry,
              width: rw,
              height: rh,
              border: active ? "1.5px solid var(--color-signal-teal)" : "1px solid transparent",
              boxShadow: active ? "0 0 0 1px rgba(45,230,196,0.15), 0 0 22px rgba(45,230,196,0.22)" : undefined,
              background: isHovered && !isSelected ? "rgba(45,230,196,0.05)" : "transparent",
            }}
            onMouseEnter={() => setHoveredRegion(region.id)}
            onMouseLeave={() => setHoveredRegion((r) => (r === region.id ? null : r))}
          >
            {active && (
              <div
                className="absolute -top-7 left-0 flex items-center gap-1.5 whitespace-nowrap rounded-md border border-ink-600 bg-ink-850/95 px-2 py-1 font-mono text-[10.5px] tracking-wide text-ink-100 shadow-lg backdrop-blur-sm"
              >
                {region.label}
                {!!counts?.open && (
                  <span className="rounded-full bg-signal-coral/20 px-1.5 text-signal-coral">{counts.open}</span>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* pins */}
      {flags.map((flag) => {
        const cx = px(flag.x);
        const cy = py(flag.y);
        const isSelected = flag.id === selectedFlagId;
        const isHovered = flag.id === hoveredPin;
        const color = STATUS_COLOR[flag.status];
        return (
          <div
            key={flag.id}
            className="absolute"
            style={{
              left: cx,
              top: cy,
              transform: "translate(-50%, -100%)",
              zIndex: isSelected ? 30 : 10,
            }}
          >
            <motion.button
              onClick={(e) => {
                e.stopPropagation();
                onSelectFlag?.(flag);
              }}
              onMouseEnter={() => setHoveredPin(flag.id)}
              onMouseLeave={() => setHoveredPin(null)}
              initial={{ scale: 0, opacity: 0, y: -14 }}
              animate={{ scale: isSelected || isHovered ? 1.18 : 1, opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 480, damping: 20 }}
              className="relative flex items-center justify-center rounded-full"
              style={{ width: 30, height: 30 }}
            >
              <span
                className="absolute inset-0 rounded-full"
                style={{
                  background: `${color}30`,
                  boxShadow: isSelected ? `0 0 0 3px ${color}55, 0 0 18px ${color}66` : `0 0 0 1px ${color}55`,
                }}
              />
              {flag.status === "open" && (
                <span className="absolute inset-0 animate-ping rounded-full" style={{ background: `${color}35` }} />
              )}
              <span
                className="relative flex h-[18px] w-[18px] items-center justify-center rounded-full border"
                style={{ background: "#0a0e14", borderColor: color }}
              >
                {flag.source === "sms" ? (
                  <Camera size={10} color={color} strokeWidth={2.5} />
                ) : (
                  <ScanLine size={10} color={color} strokeWidth={2.5} />
                )}
              </span>
              <span
                className="absolute bottom-[-3px] left-1/2 h-[6px] w-[6px] -translate-x-1/2 rotate-45"
                style={{ background: color }}
              />
            </motion.button>
          </div>
        );
      })}

      {/* controls */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-1.5 rounded-lg border border-ink-700 bg-ink-850/90 p-1 backdrop-blur-sm">
        <button
          className="rounded-md p-1.5 text-ink-200 transition hover:bg-ink-700 hover:text-white"
          onClick={() => zoomBy(1.3)}
          title="Zoom in"
        >
          <Plus size={15} />
        </button>
        <button
          className="rounded-md p-1.5 text-ink-200 transition hover:bg-ink-700 hover:text-white"
          onClick={() => zoomBy(1 / 1.3)}
          title="Zoom out"
        >
          <Minus size={15} />
        </button>
        <button
          className="rounded-md p-1.5 text-ink-200 transition hover:bg-ink-700 hover:text-white"
          onClick={() => fit()}
          title="Fit to view"
        >
          <Scan size={15} />
        </button>
      </div>
      <div className="absolute bottom-4 left-4 rounded-md border border-ink-700 bg-ink-850/80 px-2 py-1 font-mono text-[11px] text-ink-300 backdrop-blur-sm">
        {Math.round(transform.k * 100)}%
      </div>
    </div>
  );
});
