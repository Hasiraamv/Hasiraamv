import { useEffect, useRef, useState } from "react";
import { motion, useInView, animate } from "framer-motion";
import { fadeUp } from "../lib/motion.jsx";

const DAYS = [
  { day: "M", value: 0.45 },
  { day: "T", value: 0.7 },
  { day: "W", value: 0.55 },
  { day: "T", value: 0.85 },
  { day: "F", value: 0.6 },
  { day: "S", value: 0.95 },
  { day: "S", value: 0.35 },
];

const GRADIENT = [
  "linear-gradient(180deg, #22d3ee, #5b6cff)",
  "linear-gradient(180deg, #8b5cf6, #5b6cff)",
  "linear-gradient(180deg, #ff7a3c, #ff4d8d)",
];

export default function WeeklyChart() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const [heights, setHeights] = useState(() => DAYS.map(() => 0));

  useEffect(() => {
    if (!inView) return;
    const controls = DAYS.map((d, i) =>
      animate(0, d.value, {
        duration: 0.9,
        delay: i * 0.06,
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
  }, [inView]);

  return (
    <motion.div
      ref={ref}
      variants={fadeUp}
      className="glass rounded-[32px] p-6"
    >
      <div className="mb-5 flex items-end justify-between">
        <div>
          <h2 className="text-[17px] font-bold tracking-[-0.02em] text-white">
            Weekly Activity
          </h2>
          <p className="mt-0.5 text-[12px] font-medium text-white/45">
            4,520 kcal burned this week
          </p>
        </div>
        <span className="rounded-full bg-white/8 px-3 py-1 text-[11px] font-semibold text-white/60">
          Last 7 days
        </span>
      </div>

      <div className="flex h-32 items-end justify-between gap-3">
        {DAYS.map((d, i) => (
          <div
            key={`${d.day}-${i}`}
            className="flex h-full w-full flex-col items-center justify-end gap-2"
          >
            <div className="flex h-full w-full items-end justify-center">
              <div
                className="relative w-3.5 rounded-full"
                style={{
                  height: `${Math.max(heights[i] * 100, 4)}%`,
                  background: GRADIENT[i % GRADIENT.length],
                  opacity: 0.35 + 0.65 * heights[i],
                  boxShadow: heights[i] > 0.8 ? "0 0 12px rgba(91,108,255,0.5)" : "none",
                }}
              >
                {i === 5 && (
                  <span className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
                    95%
                  </span>
                )}
              </div>
            </div>
            <span
              className={`text-[11px] font-semibold ${
                i === 5 ? "text-brand-300" : "text-white/40"
              }`}
            >
              {d.day}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}