import { Bell, Flame } from "lucide-react";
import { motion } from "framer-motion";
import { fadeUp } from "../lib/motion.jsx";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function Header({ name = "there", streak = 0 }) {
  const dateLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const firstName = name.split(" ")[0];

  return (
    <motion.header variants={fadeUp} className="flex items-center justify-between px-8 pt-2">
      <div className="flex flex-col gap-1">
        <p className="text-[13px] font-medium text-white/50">{dateLabel}</p>
        <h1 className="text-[26px] font-bold tracking-[-0.03em] text-white">
          {greeting()},{" "}
          <span className="bg-gradient-to-r from-acc-lime via-acc-cyan to-acc-violet bg-clip-text text-transparent">
            {firstName}
          </span>{" "}
          👋
        </h1>
      </div>

      <div className="flex items-center gap-3">
        <motion.div
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          transition={{ type: "spring", stiffness: 400, damping: 18 }}
          className="glass-tint flex h-11 items-center gap-1.5 rounded-2xl px-3"
        >
          <Flame size={18} className="text-acc-orange" fill="currentColor" />
          <span className="text-[13px] font-bold text-white">{streak}</span>
        </motion.div>

        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          transition={{ type: "spring", stiffness: 400, damping: 18 }}
          aria-label="Notifications"
          className="glass-tint relative flex h-11 w-11 items-center justify-center rounded-2xl"
        >
          <Bell size={19} className="text-white" />
        </motion.button>
      </div>
    </motion.header>
  );
}
