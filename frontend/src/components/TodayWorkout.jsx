import { Play, Clock, ListChecks, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { fadeUp, SPRING_SNAPPY } from "../lib/motion.jsx";

export default function TodayWorkout({ workout, onAdd }) {
  if (!workout) {
    return (
      <motion.button
        variants={fadeUp}
        onClick={onAdd}
        whileTap={{ scale: 0.98 }}
        transition={SPRING_SNAPPY}
        className="relative flex w-full items-center justify-between overflow-hidden rounded-[32px] p-6 text-left"
        style={{
          background: "linear-gradient(135deg, rgba(255,122,60,0.28), rgba(255,77,141,0.2) 45%, rgba(139,92,246,0.24))",
          border: "1px solid rgba(255,255,255,0.14)",
        }}
      >
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/70">
            No workout logged today
          </span>
          <h2 className="text-[19px] font-bold tracking-[-0.02em] text-white">Ready to move?</h2>
        </div>
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white text-[#0b0e16]">
          <Plus size={24} />
        </span>
      </motion.button>
    );
  }

  const setCount = workout.sets?.length ?? 0;

  return (
    <motion.div
      variants={fadeUp}
      className="relative overflow-hidden rounded-[32px] p-6"
      style={{
        background: "linear-gradient(135deg, rgba(255,122,60,0.28), rgba(255,77,141,0.2) 45%, rgba(139,92,246,0.24))",
        border: "1px solid rgba(255,255,255,0.14)",
      }}
    >
      <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-acc-orange/20 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-8 h-40 w-40 rounded-full bg-acc-violet/20 blur-2xl" />

      <div className="relative flex items-center justify-between">
        <div className="flex flex-col gap-3">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/85 backdrop-blur-sm">
            Today's Workout
          </span>

          <h2 className="max-w-[200px] text-[22px] font-bold leading-tight tracking-[-0.02em] text-white">
            {workout.name}
          </h2>

          <div className="flex items-center gap-4 text-white/70">
            {workout.duration_minutes && (
              <span className="flex items-center gap-1.5 text-[12px] font-medium">
                <Clock size={14} />
                {workout.duration_minutes} min
              </span>
            )}
            {Array.isArray(workout.sets) ? (
              <span className="flex items-center gap-1.5 text-[12px] font-medium">
                <ListChecks size={14} />
                {setCount} sets
              </span>
            ) : (
              !workout.duration_minutes && (
                <span className="flex items-center gap-1.5 text-[12px] font-medium">
                  <ListChecks size={14} />
                  Logged
                </span>
              )
            )}
          </div>
        </div>

        <motion.div
          whileHover={{ scale: 1.1 }}
          className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white text-[#0b0e16] shadow-[0_8px_30px_rgba(255,255,255,0.25)]"
        >
          <Play size={26} fill="currentColor" className="ml-1" />
        </motion.div>
      </div>
    </motion.div>
  );
}
