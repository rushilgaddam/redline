import { initials } from "../lib/format";

export function Avatar({
  name,
  color,
  size = 32,
  ring = false,
}: {
  name: string;
  color: string;
  size?: number;
  ring?: boolean;
}) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-semibold"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: `${color}22`,
        color,
        boxShadow: ring ? `0 0 0 2px var(--color-ink-900), 0 0 0 3.5px ${color}55` : undefined,
      }}
    >
      {initials(name)}
    </div>
  );
}
