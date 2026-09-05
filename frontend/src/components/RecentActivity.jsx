import { Dumbbell, Footprints, Bike, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { fadeUp, SPRING_SNAPPY } from "../lib/motion.jsx";

const ITEMS = [
  {
    title: "Morning Run",
    meta: "5.2 km · 34 min",
    kcal: "412",
    time: "7:00 AM",
    icon: Footprints,
    color: "#22d3ee",
    bg: "rgba(34,211,238,0.12)",
  },
  {
    title: "Full Body Strength",
    meta: "45 min · 8 exercises",
    kcal: "356",
    time: "Yesterday",
    icon: Dumbbell,
    color: "#c8f31d",
    bg: "rgba(200,243,29,0.1)",
  },
  {
    title: "Cycling · Hills",
    meta: "18.4 km · 52 min",
    kcal: "680",
    time: "Yesterday",
    icon: Bike,
    color: "#5b6cff",
    bg: "rgba(91,108,255,0.16)",
  },
];

export default function RecentActivity() {
  return (
    <motion.div variants={fadeUp} className="flex flex-col gap-3">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-[17px] font-bold tracking-[-0.02em] text-white">
          Recent Activity
        </h2>
        <button className="text-[13px] font-semibold text-brand-300">
          View all
        </button>
      </div>

      <div className="glass divide-y divide-white/6 rounded-[32px]">
        {ITEMS.map((item, i) => (
          <motion.button
            key={item.title}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              ...SPRING_SNAPPY,
              delay: 0.15 + i * 0.06,
            }}
            whileTap={{ scale: 0.98 }}
            className="flex w-full items-center gap-4 px-5 py-4 text-left"
          >
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
              style={{ backgroundColor: item.bg }}
            >
              <item.icon size={20} style={{ color: item.color }} />
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-[14px] font-semibold text-white">
                {item.title}
              </span>
              <span className="text-[12px] font-medium text-white/45">
                {item.meta}
              </span>
            </div>

            <div className="flex flex-col items-end gap-0.5">
              <span className="text-[14px] font-bold text-acc-orange">
                {item.kcal} kcal
              </span>
              <span className="text-[11px] font-medium text-white/40">
                {item.time}
              </span>
            </div>

            <ArrowRight size={16} className="shrink-0 text-white/30" />
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}