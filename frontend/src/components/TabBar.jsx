import { motion } from "framer-motion";
import { Home, Dumbbell, Apple, User, Plus } from "lucide-react";
import { SPRING_SNAPPY, SPRING_BOUNCY, fadeUp } from "../lib/motion.jsx";

const TABS = [
  { id: "home", label: "Home", icon: Home },
  { id: "activity", label: "Activity", icon: Dumbbell },
  { id: "add", label: "Log", icon: Plus },
  { id: "nutrition", label: "Nutrition", icon: Apple },
  { id: "profile", label: "Profile", icon: User },
];

function FAB({ onClick }) {
  return (
    <motion.button
      whileTap={{ scale: 0.88 }}
      transition={SPRING_SNAPPY}
      onClick={onClick}
      aria-label="Add"
      className="relative -mt-7 flex h-14 w-14 items-center justify-center rounded-[20px] bg-gradient-to-br from-acc-orange to-acc-pink text-white shadow-[0_8px_30px_rgba(255,77,141,0.4)]"
    >
      <Plus size={26} />
    </motion.button>
  );
}

export default function TabBar({ active, onChange, onAdd }) {
  return (
    <motion.div variants={fadeUp} className="relative z-20 flex items-center justify-between px-6 pb-7 pt-3">
      <div className="absolute bottom-1.5 left-1/2 h-1 w-28 -translate-x-1/2 rounded-full bg-white/85" />

      <div className="glass-strong relative flex w-full items-center justify-between rounded-[28px] px-3 py-2.5 shadow-[0_10px_40px_rgba(0,0,0,0.45)]">
        {TABS.map((tab) => {
          const isActive = active === tab.id;
          const isFAB = tab.id === "add";

          return isFAB ? (
            <FAB key={tab.id} onClick={onAdd} />
          ) : (
            <motion.button
              key={tab.id}
              whileTap={{ scale: 0.9 }}
              transition={SPRING_SNAPPY}
              onClick={() => onChange(tab.id)}
              aria-label={tab.label}
              aria-current={isActive ? "page" : undefined}
              className="relative flex h-12 w-12 flex-col items-center justify-center gap-0.5"
            >
              {isActive && (
                <motion.span
                  layoutId="tab-pill"
                  transition={SPRING_BOUNCY}
                  className="absolute inset-0 rounded-2xl bg-white/10"
                />
              )}

              <motion.span
                animate={{ scale: isActive ? 1.12 : 1, y: isActive ? -1 : 0 }}
                transition={SPRING_SNAPPY}
                className="relative"
              >
                <tab.icon size={21} strokeWidth={isActive ? 2.6 : 2} className={isActive ? "text-white" : "text-white/40"} />
              </motion.span>

              <span
                className={`relative text-[9px] font-semibold uppercase tracking-[0.08em] ${
                  isActive ? "text-white" : "text-white/35"
                }`}
              >
                {tab.label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}
