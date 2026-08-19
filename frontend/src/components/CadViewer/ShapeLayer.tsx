import type { Shape } from "../../lib/types";

const CLASS_STYLE: Record<string, { stroke?: string; fill?: string; sw?: number; dash?: string; opacity?: number }> = {
  outline: { stroke: "#27272a", sw: 1.5, fill: "none" },
  detail: { stroke: "#71717a", sw: 1, fill: "none" },
  wire: { stroke: "#2563eb", sw: 1.3, fill: "none" },
  dim: { stroke: "#a1a1aa", sw: 0.8, fill: "none" },
  centerline: { stroke: "#a1a1aa", sw: 0.8, dash: "10 4 1.5 4", fill: "none" },
  hatch: { stroke: "#d4d4d8", sw: 0.6, fill: "none" },
  guard: { stroke: "#d97706", sw: 1.1, dash: "5 4", fill: "none", opacity: 0.85 },
  leader: { stroke: "#a1a1aa", sw: 0.8, dash: "3 3", fill: "none" },
  sheet: { stroke: "#d4d4d8", sw: 1.2, fill: "none" },
  "sheet-inner": { stroke: "#e4e4e7", sw: 0.6, fill: "none" },
};

const TEXT_CLASS: Record<string, { fill: string; weight?: number; letterSpacing?: number; family?: string }> = {
  label: { fill: "#52525b", letterSpacing: 0.5 },
  "dim-label": { fill: "#a1a1aa" },
  tag: { fill: "#71717a" },
  "zone-label": { fill: "#d4d4d8" },
  "gdt-sym": { fill: "#2563eb", weight: 700 },
};

function Def({ id }: { id: string }) {
  return (
    <marker
      id={id}
      viewBox="0 0 10 10"
      refX="8"
      refY="5"
      markerWidth="6"
      markerHeight="6"
      orient="auto-start-reverse"
    >
      <path d="M0,0 L10,5 L0,10 z" fill="#a1a1aa" />
    </marker>
  );
}

export function ShapeDefs() {
  return (
    <defs>
      <Def id="arrow" />
    </defs>
  );
}

export function ShapeLayer({ shapes }: { shapes: Shape[] }) {
  return (
    <g>
      {shapes.map((s, i) => {
        const style = CLASS_STYLE[s.class] ?? CLASS_STYLE.detail;
        const common = {
          stroke: style.stroke,
          strokeWidth: style.sw,
          strokeDasharray: style.dash,
          fill: style.fill,
          opacity: style.opacity,
        };

        switch (s.type) {
          case "rect":
            return (
              <rect
                key={i}
                x={s.x as number}
                y={s.y as number}
                width={s.w as number}
                height={s.h as number}
                rx={(s.rx as number) ?? 0}
                {...common}
              />
            );
          case "circle":
            return <circle key={i} cx={s.cx as number} cy={s.cy as number} r={s.r as number} {...common} />;
          case "line":
            return (
              <line
                key={i}
                x1={s.x1 as number}
                y1={s.y1 as number}
                x2={s.x2 as number}
                y2={s.y2 as number}
                markerStart={s.arrows ? "url(#arrow)" : undefined}
                markerEnd={s.arrows ? "url(#arrow)" : undefined}
                {...common}
              />
            );
          case "path":
            return <path key={i} d={s.d as string} {...common} />;
          case "image":
            return (
              <image
                key={i}
                href={s.href as string}
                x={s.x as number}
                y={s.y as number}
                width={s.w as number}
                height={s.h as number}
                preserveAspectRatio="xMidYMid slice"
                opacity={0.92}
              />
            );
          case "polyline":
            return <polyline key={i} points={s.points as string} {...common} />;
          case "text": {
            const t = TEXT_CLASS[s.class] ?? TEXT_CLASS.label;
            const rot = s.rot as number | undefined;
            const transform = rot ? `rotate(${rot} ${s.rotX ?? s.x} ${s.rotY ?? s.y})` : undefined;
            return (
              <text
                key={i}
                x={s.x as number}
                y={s.y as number}
                fontSize={(s.size as number) ?? 10}
                textAnchor={(s.anchor as "start" | "middle" | "end") ?? "middle"}
                fill={t.fill}
                fontWeight={t.weight}
                letterSpacing={t.letterSpacing}
                fontFamily="var(--font-mono)"
                transform={transform}
                style={{ userSelect: "none" }}
              >
                {s.text as string}
              </text>
            );
          }
          default:
            return null;
        }
      })}
    </g>
  );
}
