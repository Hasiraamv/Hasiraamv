import { Dumbbell, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { fadeUp, SPRING_SNAPPY } from "../lib/motion.jsx";

function formatDate(iso) {
  const date = new Date(iso + "T00:00:00");
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a, b) => a.toDateString() === b.toDateString();
  if (sameDay(date, today)) return "Today";
  if (sameDay(date, yesterday)) return "Yesterday";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function RecentActivity({ items = [], onViewAll }) {
  return (
    <motion.div variants={fadeUp} className="flex flex-col gap-3">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-[17px] font-bold tracking-[-0.02em] text-ink">Recent Activity</h2>
        <button onClick={onViewAll} className="text-[13px] font-semibold text-brand-300">
          View all
        </button>
      </div>

      {items.length === 0 ? (
        <div className="glass-tint rounded-[32px] px-5 py-8 text-center text-[13px] font-medium text-ink/40">
          No workouts logged yet.
        </div>
      ) : (
        <div className="glass divide-y divide-ink/6 rounded-[32px]">
          {items.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ ...SPRING_SNAPPY, delay: 0.15 + i * 0.06 }}
              className="flex w-full items-center gap-4 px-5 py-4 text-left"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-acc-lime/10">
                <Dumbbell size={20} className="text-acc-lime" />
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-[14px] font-semibold text-ink">{item.name}</span>
                <span className="text-[12px] font-medium text-ink/45">
                  {item.duration_minutes ? `${item.duration_minutes} min` : "Logged"}
                </span>
              </div>

              <span className="text-[11px] font-medium text-ink/40">{formatDate(item.date)}</span>
              <ArrowRight size={16} className="shrink-0 text-ink/30" />
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
