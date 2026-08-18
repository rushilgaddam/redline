import clsx from "clsx";
import type { FlagStatus } from "../lib/types";

const STYLES: Record<FlagStatus, { label: string; dot: string; text: string; bg: string }> = {
  open: { label: "Open", dot: "bg-signal-coral", text: "text-signal-coral", bg: "bg-signal-coral/10" },
  answered: { label: "Tentative", dot: "bg-signal-amber", text: "text-signal-amber", bg: "bg-signal-amber/10" },
  resolved: { label: "Resolved", dot: "bg-signal-teal", text: "text-signal-teal", bg: "bg-signal-teal/10" },
};

export function StatusBadge({ status, pulse = false }: { status: FlagStatus; pulse?: boolean }) {
  const s = STYLES[status];
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium tracking-wide",
        s.text,
        s.bg,
      )}
    >
      <span className={clsx("relative h-1.5 w-1.5 rounded-full", s.dot)}>
        {pulse && status === "open" && (
          <span className={clsx("absolute inset-0 animate-ping rounded-full", s.dot)} />
        )}
      </span>
      {s.label}
    </span>
  );
}
