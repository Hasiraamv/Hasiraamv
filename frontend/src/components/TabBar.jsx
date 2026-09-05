import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home,
  Activity,
  Map,
  User,
  Plus,
} from "lucide-react";
import { SPRING_SNAPPY, SPRING_BOUNCY, fadeUp } from "../lib/motion.jsx";

const TABS = [
  { id: "home", label: "Home", icon: Home },
  { id: "activity", label: "Activity", icon: Activity },
  { id: "add", label: "Log", icon: Plus },
  { id: "explore", label: "Explore", icon: Map },
  { id: "profile", label: "Profile", icon: User },
];

/* Floating action button expands with spring physics on tap */
function FAB() {
  const [open, setOpen] = useState(false);

  return (
    <motion.button
      whileTap={{ scale: 0.88 }}
      transition={SPRING_SNAPPY}
      onClick={() => setOpen((o) => !o)}
      aria-label="Add activity"
      className="relative -mt-7 flex h-14 w-14 items-center justify-center rounded-[20px] bg-gradient-to-br from-acc-orange to-acc-pink text-white shadow-[0_8px_30px_rgba(255,77,141,0.4)]"
    >
      <motion.span
        animate={{ rotate: open ? 45 : 0, scale: open ? 0.8 : 1 }}
        transition={SPRING_BOUNCY}
      >
        <Plus size={26} />
      </motion.span>

      <AnimatePresence>
        {open && (
          <motion.span
            initial={{ opacity: 0, y: 8, scale: 0.9 }}
            animate={{ opacity: 1, y: -4, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.9 }}
            transition={SPRING_SNAPPY}
            className="absolute -top-2 left-1/2 -translate-x-1/2 translate-y-full whitespace-nowrap rounded-full bg-white/95 px-3 py-1 text-[11px] font-bold text-black shadow-lg"
          >
            Log workout
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

export default function TabBar({ active, onChange }) {
  return (
    <motion.div
      variants={fadeUp}
      className="relative z-20 flex items-center justify-between px-6 pb-7 pt-3"
    >
      {/* Home indicator */}
      <div className="absolute bottom-1.5 left-1/2 h-1 w-28 -translate-x-1/2 rounded-full bg-white/85" />

      {/* Glass bar */}
      <div className="glass-strong relative flex w-full items-center justify-between rounded-[28px] px-3 py-2.5 shadow-[0_10px_40px_rgba(0,0,0,0.45)]">
        {TABS.map((tab) => {
          const isActive = active === tab.id;
          const isFAB = tab.id === "add";

          return isFAB ? (
            <FAB key={tab.id} />
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
              {/* Active pill indicator */}
              {isActive && (
                <motion.span
                  layoutId="tab-pill"
                  transition={SPRING_BOUNCY}
                  className="absolute inset-0 rounded-2xl bg-white/10"
                />
              )}

              <motion.span
                animate={{
                  scale: isActive ? 1.12 : 1,
                  y: isActive ? -1 : 0,
                }}
                transition={SPRING_SNAPPY}
                className="relative"
              >
                <tab.icon
                  size={21}
                  strokeWidth={isActive ? 2.6 : 2}
                  className={isActive ? "text-white" : "text-white/40"}
                />
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