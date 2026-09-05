import { Footprints, HeartPulse, Timer, Trophy } from "lucide-react";
import { motion } from "framer-motion";
import { fadeUp } from "../lib/motion.jsx";

const STATS = [
  {
    label: "Steps",
    value: "8,482",
    sub: "+12%",
    icon: Footprints,
    color: "#22d3ee",
    bg: "rgba(34,211,238,0.12)",
  },
  {
    label: "Heart Rate",
    value: "74",
    sub: "bpm",
    icon: HeartPulse,
    color: "#ff4d8d",
    bg: "rgba(255,77,141,0.12)",
  },
  {
    label: "Active Min",
    value: "46",
    sub: "/50",
    icon: Timer,
    color: "#c8f31d",
    bg: "rgba(200,243,29,0.1)",
  },
  {
    label: "Goal Streak",
    value: "12",
    sub: "days",
    icon: Trophy,
    color: "#ffb020",
    bg: "rgba(255,176,32,0.14)",
  },
];

export default function QuickStats() {
  return (
    <div className="grid grid-cols-4 gap-3">
      {STATS.map((stat) => (
        <motion.div
          key={stat.label}
          variants={fadeUp}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          transition={{ type: "spring", stiffness: 400, damping: 20 }}
          className="glass flex flex-col items-center gap-2 rounded-3xl px-2 py-4 text-center"
        >
          <div
            className="flex h-9 w-9 items-center justify-center rounded-2xl"
            style={{ backgroundColor: stat.bg }}
          >
            <stat.icon size={18} style={{ color: stat.color }} />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[16px] font-bold leading-none tracking-[-0.02em] text-white">
              {stat.value}
            </span>
            <span className="text-[10px] font-medium leading-tight text-white/45">
              {stat.sub}
            </span>
          </div>
          <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-white/40">
            {stat.label}
          </span>
        </motion.div>
      ))}
    </div>
  );
}