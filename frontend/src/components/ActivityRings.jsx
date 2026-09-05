import { useEffect, useRef, useState } from "react";
import { motion, useInView, animate } from "framer-motion";
import { fadeUp } from "../lib/motion.jsx";

const RING_SIZE = 216;
const CENTER = RING_SIZE / 2;
const MAX_RADIUS = 92;
const STROKE = 17;

/* Apple-Fitness-style rings */
const RINGS = [
  {
    key: "move",
    label: "Move",
    color: "#fa5c37",
    track: "rgba(250,92,55,0.14)",
    radius: MAX_RADIUS,
    progress: 0.78,
    value: "482",
    goal: "600 kcal",
  },
  {
    key: "exercise",
    label: "Exercise",
    color: "#8aff5c",
    track: "rgba(138,255,92,0.14)",
    radius: MAX_RADIUS - STROKE - 5,
    progress: 0.52,
    value: "26",
    goal: "50 min",
  },
  {
    key: "stand",
    label: "Stand",
    color: "#55aef7",
    track: "rgba(85,174,247,0.14)",
    radius: MAX_RADIUS - (STROKE + 5) * 2,
    progress: 0.9,
    value: "9",
    goal: "12 hrs",
  },
];

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

function RingSegment({
  color,
  track,
  radius,
  animatedProgress,
}) {
  const full = 270; // degrees of travel
  const circumference = (2 * Math.PI * radius * full) / 360;

  return (
    <g>
      {/* Track */}
      <path
        d={ringPath(radius, 1)}
        fill="none"
        stroke={track}
        strokeWidth={STROKE}
        strokeLinecap="round"
      />
      {/* Progress */}
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
          style={{
            filter: `drop-shadow(0 0 6px ${color}66)`,
          }}
        />
      )}
    </g>
  );
}

/**
 * Apple Fitness-style animated activity rings.
 * Progress animates in with spring physics on scroll-into-view.
 */
export default function ActivityRings() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const [animated, setAnimated] = useState({ move: 0, exercise: 0, stand: 0 });

  useEffect(() => {
    if (!inView) return;
    const controls = [
      animate(0, 1, {
        duration: 1.6,
        ease: [0.34, 1.56, 0.64, 1], // spring-ish overshoot
        onUpdate: (v) =>
          setAnimated((prev) => ({
            ...prev,
            move: v * RINGS[0].progress,
            exercise: v * RINGS[1].progress,
            stand: v * RINGS[2].progress,
          })),
      }),
    ];
    return () => controls.forEach((c) => c.stop());
  }, [inView]);

  return (
    <motion.div
      ref={ref}
      variants={fadeUp}
      className="glass relative flex items-center justify-center rounded-[32px] p-6"
    >
      <div className="relative">
        <svg
          width={RING_SIZE}
          height={RING_SIZE}
          viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
          className="-rotate-0"
        >
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

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
            Today
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-[46px] font-black leading-none tracking-[-0.04em] text-white">
              482
            </span>
            <span className="text-sm font-semibold text-white/50">kcal</span>
          </div>
          <span className="mt-1 flex items-center gap-1.5 text-[12px] font-medium text-white/45">
            <span className="h-1.5 w-1.5 rounded-full bg-ring-exercise" />
            Goal: 600 kcal
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="absolute bottom-5 left-0 right-0 flex items-center justify-center gap-6">
        {RINGS.map((ring) => (
          <div key={ring.key} className="flex items-center gap-1.5">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: ring.color }}
            />
            <span className="text-[11px] font-medium text-white/50">
              {ring.value} {ring.label}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}