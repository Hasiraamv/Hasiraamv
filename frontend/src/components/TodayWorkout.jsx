import { Play, Clock, Flame } from "lucide-react";
import { motion } from "framer-motion";
import { fadeUp, SPRING_SNAPPY } from "../lib/motion.jsx";

export default function TodayWorkout() {
  return (
    <motion.div
      variants={fadeUp}
      className="relative overflow-hidden rounded-[32px] p-6"
      style={{
        background:
          "linear-gradient(135deg, rgba(255,122,60,0.28), rgba(255,77,141,0.2) 45%, rgba(139,92,246,0.24))",
        border: "1px solid rgba(255,255,255,0.14)",
      }}
    >
      {/* Decorative circles */}
      <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-acc-orange/20 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-8 h-40 w-40 rounded-full bg-acc-violet/20 blur-2xl" />

      <div className="relative flex items-center justify-between">
        <div className="flex flex-col gap-3">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/85 backdrop-blur-sm">
            <Flame size={12} className="text-acc-lime" />
            Today's Workout
          </span>

          <h2 className="max-w-[200px] text-[22px] font-bold leading-tight tracking-[-0.02em] text-white">
            HIIT Full Body
            <span className="text-white/55"> · Level 2</span>
          </h2>

          <div className="flex items-center gap-4 text-white/70">
            <span className="flex items-center gap-1.5 text-[12px] font-medium">
              <Clock size={14} />
              32 min
            </span>
            <span className="h-1 w-1 rounded-full bg-white/30" />
            <span className="flex items-center gap-1.5 text-[12px] font-medium">
              <Flame size={14} />
              380 kcal
            </span>
            <span className="h-1 w-1 rounded-full bg-white/30" />
            <span className="text-[12px] font-medium">8 exercises</span>
          </div>
        </div>

        {/* Circular play button */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.92 }}
          transition={SPRING_SNAPPY}
          aria-label="Start workout"
          className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white text-[#0b0e16] shadow-[0_8px_30px_rgba(255,255,255,0.25)]"
        >
          <span className="absolute inset-0 animate-ping rounded-full bg-white/30" style={{ animationDuration: "2.5s" }} />
          <Play size={26} fill="currentColor" className="ml-1" />
        </motion.button>
      </div>
    </motion.div>
  );
}