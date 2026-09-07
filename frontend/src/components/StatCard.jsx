import { useEffect, useRef, useState } from "react";
import { motion, useInView, animate } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { fadeUp } from "../lib/motion.jsx";

/**
 * Compact tile with a headline value and a 7-day mini bar sparkline,
 * modeled after the Step Count / Step Distance tiles in Apple's
 * Fitness summary screen.
 *
 * `days` = [{ day: "M", value: 32 }, ...] oldest first.
 */
export default function StatCard({ label, value, unit, sub = "Today", color = "#ff7a00", days = [] }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const [heights, setHeights] = useState(() => days.map(() => 0));
  const max = Math.max(1, ...days.map((d) => d.value));

  useEffect(() => {
    if (!inView) return;
    const controls = days.map((d, i) =>
      animate(0, d.value / max, {
        duration: 0.8,
        delay: i * 0.05,
        ease: [0.34, 1.56, 0.64, 1],
        onUpdate: (v) =>
          setHeights((prev) => {
            const next = [...prev];
            next[i] = v;
            return next;
          }),
      })
    );
    return () => controls.forEach((c) => c.stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, days]);

  return (
    <motion.div ref={ref} variants={fadeUp} className="glass flex flex-col rounded-[28px] p-5">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[13px] font-bold text-ink">{label}</span>
        <ChevronRight size={15} className="text-ink/25" />
      </div>
      <span className="mb-2 text-[11px] font-medium text-ink/40">{sub}</span>

      <div className="mb-3 flex items-baseline gap-1">
        <span className="text-[24px] font-black leading-none tracking-[-0.02em] text-ink">{value}</span>
        {unit && <span className="text-[12px] font-bold uppercase text-ink/45">{unit}</span>}
      </div>

      <div className="flex h-10 items-end justify-between gap-1.5">
        {days.map((d, i) => (
          <div key={`${d.day}-${i}`} className="flex h-full flex-1 items-end justify-center">
            <div
              className="w-full max-w-[7px] rounded-full"
              style={{
                height: `${Math.max(heights[i] * 100, 6)}%`,
                backgroundColor: color,
                opacity: 0.35 + 0.65 * heights[i],
              }}
            />
          </div>
        ))}
      </div>
    </motion.div>
  );
}
