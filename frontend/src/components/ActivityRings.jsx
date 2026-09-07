import { useEffect, useRef, useState } from "react";
import { motion, useInView, animate } from "framer-motion";
import { fadeUp } from "../lib/motion.jsx";

const RING_SIZE = 148;
const CENTER = RING_SIZE / 2;
const MAX_RADIUS = 62;
const STROKE = 13;

function clamp01(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

/* Polar→cartesian for SVG arc end points */
function polar(cx, cy, r, angleInDegrees) {
  const a = ((angleInDegrees - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(a),
    y: cy + r * Math.sin(a),
  };
}

/* Full circle segment path (gap at bottom like Apple rings) */
function ringPath(radius, progress) {
  const start = polar(CENTER, CENTER, radius, 135);
  const end = polar(CENTER, CENTER, radius, 135 + 270 * progress);
  const largeArc = progress > 0.5 ? 1 : 0;
  const sweep = 1;
  if (progress <= 0) return "";
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} ${sweep} ${end.x} ${end.y}`;
}

function RingSegment({ color, track, radius, animatedProgress }) {
  const full = 270; // degrees of travel
  const circumference = (2 * Math.PI * radius * full) / 360;

  return (
    <g>
      <path d={ringPath(radius, 1)} fill="none" stroke={track} strokeWidth={STROKE} strokeLinecap="round" />
      {animatedProgress > 0.01 && (
        <motion.path
          d={ringPath(radius, Math.min(animatedProgress, 1))}
          fill="none"
          stroke={color}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={`${circumference * animatedProgress} ${circumference}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          style={{ filter: `drop-shadow(0 0 6px ${color}66)` }}
        />
      )}
    </g>
  );
}

/**
 * FitPocket "Activity Rings" summary card, styled after the classic
 * Move/Exercise/Stand layout: a compact ring graphic on the left, a
 * stacked list of stat rows (value / goal) on the right.
 *
 *  - Calories: consumed vs daily target
 *  - Workouts: sessions logged in the last 7 days vs a goal
 *  - Budget: share of this month's budget remaining
 */
export default function ActivityRings({
  calories = 0,
  caloriesGoal = 2000,
  workouts = 0,
  workoutsGoal = 5,
  budgetLeftPct = 1,
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const [animated, setAnimated] = useState({ calories: 0, workouts: 0, budget: 0 });

  const targets = {
    calories: clamp01(caloriesGoal ? calories / caloriesGoal : 0),
    workouts: clamp01(workoutsGoal ? workouts / workoutsGoal : 0),
    budget: clamp01(budgetLeftPct),
  };

  // Track uses a neutral, theme-aware color (not a tint of the ring color)
  // so an empty ring reads as genuinely empty instead of "already filled".
  const TRACK = "var(--surface-border-strong)";

  const RINGS = [
    {
      key: "calories",
      label: "Calories",
      color: "#ff7a00",
      track: TRACK,
      radius: MAX_RADIUS,
      progress: targets.calories,
      value: `${Math.round(calories)}`,
      goal: `${caloriesGoal ?? "—"} cal`,
    },
    {
      key: "workouts",
      label: "Workouts",
      color: "#c9922c",
      track: TRACK,
      radius: MAX_RADIUS - STROKE - 4,
      progress: targets.workouts,
      value: `${workouts}`,
      goal: `${workoutsGoal} this week`,
    },
    {
      key: "budget",
      label: "Budget left",
      color: "#8a7460",
      track: TRACK,
      radius: MAX_RADIUS - (STROKE + 4) * 2,
      progress: targets.budget,
      value: `${Math.round(targets.budget * 100)}%`,
      goal: "of this month",
    },
  ];

  useEffect(() => {
    if (!inView) return;
    const controls = [
      animate(0, 1, {
        duration: 1.6,
        ease: [0.34, 1.56, 0.64, 1],
        onUpdate: (v) =>
          setAnimated({
            calories: v * targets.calories,
            workouts: v * targets.workouts,
            budget: v * targets.budget,
          }),
      }),
    ];
    return () => controls.forEach((c) => c.stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, calories, workouts, budgetLeftPct]);

  return (
    <motion.div ref={ref} variants={fadeUp} className="glass rounded-[32px] p-6">
      <h2 className="mb-5 text-[17px] font-bold tracking-[-0.02em] text-ink">Activity Rings</h2>

      <div className="flex items-center gap-6">
        <div className="relative shrink-0">
          <svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
            {RINGS.map((ring) => (
              <RingSegment
                key={ring.key}
                color={ring.color}
                track={ring.track}
                radius={ring.radius}
                animatedProgress={animated[ring.key]}
              />
            ))}
          </svg>
        </div>

        <div className="flex flex-1 flex-col gap-4">
          {RINGS.map((ring) => (
            <div key={ring.key} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-[13px] font-semibold text-ink/60">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: ring.color, boxShadow: `0 0 6px ${ring.color}66` }}
                />
                {ring.label}
              </span>
              <span className="text-right text-[15px] font-bold leading-tight text-ink">
                {ring.value}
                <span className="ml-1 text-[11px] font-semibold uppercase tracking-[0.04em] text-ink/40">
                  {ring.goal}
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
