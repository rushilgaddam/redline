function toneFor(pct: number) {
  if (pct >= 65) return { fg: "var(--color-signal-teal)", bg: "rgba(5,150,105,0.12)" };
  if (pct >= 40) return { fg: "var(--color-signal-amber)", bg: "rgba(217,119,6,0.12)" };
  return { fg: "var(--color-signal-coral)", bg: "rgba(220,38,38,0.12)" };
}

export function ConfidenceMeter({ value, size = 40 }: { value: number; size?: number }) {
  const pct = Math.max(0, Math.min(100, value));
  const { fg, bg } = toneFor(pct);
  const r = (size - 5) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct / 100);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={bg} strokeWidth={4} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={fg}
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div
        className="absolute inset-0 flex items-center justify-center font-mono font-semibold mono-num"
        style={{ fontSize: size * 0.28, color: fg }}
      >
        {Math.round(pct)}
      </div>
    </div>
  );
}
