import { useEffect } from "react";
import { animate, useMotionValue, useTransform, motion } from "framer-motion";

export function CountUp({ value, className }: { value: number; className?: string }) {
  const motionValue = useMotionValue(0);
  const rounded = useTransform(motionValue, (v) => Math.round(v).toString());

  useEffect(() => {
    const controls = animate(motionValue, value, {
      duration: 0.5,
      ease: [0.16, 1, 0.3, 1],
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return <motion.span className={className}>{rounded}</motion.span>;
}
