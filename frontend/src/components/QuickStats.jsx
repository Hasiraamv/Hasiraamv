import { Flame, Dumbbell, Timer, Wallet } from "lucide-react";
import { motion } from "framer-motion";
import { fadeUp } from "../lib/motion.jsx";

export default function QuickStats({ calories = 0, workoutsThisWeek = 0, activeMinutes = 0, budgetLeft = 0 }) {
  const STATS = [
    { label: "Calories", value: `${Math.round(calories)}`, sub: "today", icon: Flame, color: "#ff7a3c", bg: "rgba(255,122,60,0.12)" },
    { label: "Workouts", value: `${workoutsThisWeek}`, sub: "this week", icon: Dumbbell, color: "#c8f31d", bg: "rgba(200,243,29,0.1)" },
    { label: "Active Min", value: `${activeMinutes}`, sub: "this week", icon: Timer, color: "#22d3ee", bg: "rgba(34,211,238,0.12)" },
    { label: "Budget Left", value: `₹${Math.round(budgetLeft)}`, sub: "this month", icon: Wallet, color: "#55aef7", bg: "rgba(85,174,247,0.14)" },
  ];

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
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl" style={{ backgroundColor: stat.bg }}>
            <stat.icon size={18} style={{ color: stat.color }} />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="truncate text-[15px] font-bold leading-none tracking-[-0.02em] text-white">
              {stat.value}
            </span>
            <span className="text-[10px] font-medium leading-tight text-white/45">{stat.sub}</span>
          </div>
          <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-white/40">{stat.label}</span>
        </motion.div>
      ))}
    </div>
  );
}
