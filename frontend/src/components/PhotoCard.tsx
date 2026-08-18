import { ImageOff, Camera } from "lucide-react";
import clsx from "clsx";
import { getMockPhoto } from "../lib/mockPhotos";

export function PhotoCard({
  photoRef,
  size = "md",
}: {
  photoRef: string | null | undefined;
  size?: "sm" | "md" | "lg";
}) {
  const photo = getMockPhoto(photoRef);
  const dims = size === "lg" ? "h-64 w-full" : size === "md" ? "h-40 w-56" : "h-20 w-28";

  if (!photo) {
    return (
      <div className={clsx(dims, "flex items-center justify-center rounded-lg border border-dashed border-ink-600 text-ink-400")}>
        <ImageOff size={18} />
      </div>
    );
  }

  return (
    <div className={clsx(dims, "group relative shrink-0 overflow-hidden rounded-lg border border-ink-600 bg-gradient-to-br shadow-lg", photo.gradient)}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.08),transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 bg-grain opacity-30 mix-blend-overlay" />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 p-2 text-center">
        <Camera size={size === "sm" ? 14 : 20} className="text-white/70" strokeWidth={1.5} />
        <span className="font-mono text-[10px] leading-tight text-white/60">{photo.label}</span>
      </div>
      <div className="absolute inset-x-0 bottom-0 bg-black/40 px-1.5 py-0.5 font-mono text-[9px] tracking-wide text-white/50 backdrop-blur-sm">
        MMS · {photo.id.replace("mock:", "IMG_").slice(0, 14)}
      </div>
    </div>
  );
}
