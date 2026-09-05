import { Play, Clock, ListChecks, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { fadeUp, SPRING_SNAPPY } from "../lib/motion.jsx";

const CARD_GRADIENT = "linear-gradient(135deg, #ff7a00, #ff4d8d 55%, #8b5cf6)";

export default function TodayWorkout({ workout, onAdd }) {
  if (!workout) {
    return (
      <motion.button
        variants={fadeUp}
        onClick={onAdd}
        whileTap={{ scale: 0.98 }}
        transition={SPRING_SNAPPY}
        className="relative flex w-full items-center justify-between overflow-hidden rounded-[32px] p-6 text-left"
        style={{ background: CARD_GRADIENT }}
      >
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/75">
            No workout logged today
          </span>
          <h2 className="text-[19px] font-bold tracking-[-0.02em] text-white">Ready to move?</h2>
        </div>
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white text-ink">
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
      style={{ background: CARD_GRADIENT }}
    >
      <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-8 h-40 w-40 rounded-full bg-white/10 blur-2xl" />

      <div className="relative flex items-center justify-between">
        <div className="flex flex-col gap-3">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/18 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white backdrop-blur-sm">
            Today's Workout
          </span>

          <h2 className="max-w-[200px] text-[22px] font-bold leading-tight tracking-[-0.02em] text-white">
            {workout.name}
          </h2>

          <div className="flex items-center gap-4 text-white/85">
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
          className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white text-ink shadow-[0_8px_24px_rgba(16,20,31,0.2)]"
        >
          <Play size={26} fill="currentColor" className="ml-1" />
        </motion.div>
      </div>
    </motion.div>
  );
}
