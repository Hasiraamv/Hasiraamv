import { Dumbbell, Footprints, Bike, Waves, Flame, HeartPulse } from "lucide-react";
import { motion } from "framer-motion";
import { fadeUp, SPRING_SNAPPY } from "../lib/motion.jsx";

const CATEGORIES = [
  { label: "Strength", icon: Dumbbell, color: "#c8f31d" },
  { label: "Running", icon: Footprints, color: "#22d3ee" },
  { label: "Cycling", icon: Bike, color: "#5b6cff" },
  { label: "Swimming", icon: Waves, color: "#55aef7" },
  { label: "HIIT", icon: Flame, color: "#ff7a3c" },
  { label: "Yoga", icon: HeartPulse, color: "#ff4d8d" },
];

export default function WorkoutCategories({ onSelect }) {
  return (
    <motion.div variants={fadeUp} className="flex flex-col gap-3">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-[17px] font-bold tracking-[-0.02em] text-white">
          Workouts
        </h2>
        <button onClick={onSelect} className="text-[13px] font-semibold text-brand-300">
          See all
        </button>
      </div>

      <div className="no-scrollbar -mx-8 flex gap-3 overflow-x-auto px-8 pb-1">
        {CATEGORIES.map((cat) => (
          <motion.button
            key={cat.label}
            onClick={onSelect}
            whileHover={{ y: -2, scale: 1.04 }}
            whileTap={{ scale: 0.95 }}
            transition={SPRING_SNAPPY}
            className="glass flex shrink-0 flex-col items-center gap-2 rounded-3xl px-5 py-4"
          >
            <div
              className="flex h-11 w-11 items-center justify-center rounded-2xl"
              style={{ backgroundColor: `${cat.color}1f` }}
            >
              <cat.icon size={20} style={{ color: cat.color }} />
            </div>
            <span className="text-[12px] font-semibold text-white/80">
              {cat.label}
            </span>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}