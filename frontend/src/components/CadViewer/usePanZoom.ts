import { useCallback, useEffect, useRef, useState } from "react";

export interface Transform {
  x: number;
  y: number;
  k: number;
}

const MIN_K = 0.4;
const MAX_K = 8;

export function usePanZoom(
  containerRef: React.RefObject<HTMLDivElement | null>,
  contentSize: { w: number; h: number },
) {
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, k: 1 });
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [isPanning, setIsPanning] = useState(false);

  const fit = useCallback(
    (padding = 48) => {
      const el = containerRef.current;
      if (!el || !contentSize.w || !contentSize.h) return;
      const rect = el.getBoundingClientRect();
      const k = Math.min(
        (rect.width - padding * 2) / contentSize.w,
        (rect.height - padding * 2) / contentSize.h,
      );
      const x = (rect.width - contentSize.w * k) / 2;
      const y = (rect.height - contentSize.h * k) / 2;
      setTransform({ x, y, k });
    },
    [containerRef, contentSize.w, contentSize.h],
  );

  useEffect(() => {
    fit();
    const onResize = () => fit();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentSize.w, contentSize.h]);

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      setTransform((t) => {
        const delta = -e.deltaY * 0.0016;
        const nk = Math.min(MAX_K, Math.max(MIN_K, t.k * (1 + delta)));
        const scale = nk / t.k;
        return {
          k: nk,
          x: mx - (mx - t.x) * scale,
          y: my - (my - t.y) * scale,
        };
      });
    },
    [containerRef],
  );

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: 0, origY: 0 };
    setTransform((t) => {
      dragRef.current!.origX = t.x;
      dragRef.current!.origY = t.y;
      return t;
    });
    setIsPanning(true);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setTransform((t) => ({ ...t, x: dragRef.current!.origX + dx, y: dragRef.current!.origY + dy }));
  }, []);

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
    setIsPanning(false);
  }, []);

  const zoomBy = useCallback(
    (factor: number) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const mx = rect.width / 2;
      const my = rect.height / 2;
      setTransform((t) => {
        const nk = Math.min(MAX_K, Math.max(MIN_K, t.k * factor));
        const scale = nk / t.k;
        return { k: nk, x: mx - (mx - t.x) * scale, y: my - (my - t.y) * scale };
      });
    },
    [containerRef],
  );

  const focusOn = useCallback(
    (px: number, py: number, targetK = 2.2) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setTransform({
        k: targetK,
        x: rect.width / 2 - px * targetK,
        y: rect.height / 2 - py * targetK,
      });
    },
    [containerRef],
  );

  return { transform, isPanning, onWheel, onPointerDown, onPointerMove, onPointerUp, fit, zoomBy, focusOn };
}
