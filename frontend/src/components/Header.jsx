import { Bell, Flame } from "lucide-react";
import { motion } from "framer-motion";
import { fadeUp } from "../lib/motion.jsx";

export default function Header() {
  return (
    <motion.header
      variants={fadeUp}
      className="flex items-center justify-between px-8 pt-2"
    >
      {/* Greeting */}
      <div className="flex flex-col gap-1">
        <p className="text-[13px] font-medium text-white/50">
          Tuesday, September 6
        </p>
        <h1 className="text-[26px] font-bold tracking-[-0.03em] text-white">
          Good morning,{" "}
          <span className="bg-gradient-to-r from-acc-lime via-acc-cyan to-acc-violet bg-clip-text text-transparent">
            Alex
          </span>
          👋
        </h1>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        {/* Streak badge */}
        <motion.div
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          transition={{ type: "spring", stiffness: 400, damping: 18 }}
          className="glass-tint flex h-11 items-center gap-1.5 rounded-2xl px-3"
        >
          <Flame size={18} className="text-acc-orange" fill="currentColor" />
          <span className="text-[13px] font-bold text-white">12</span>
        </motion.div>

        {/* Notification bell */}
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          transition={{ type: "spring", stiffness: 400, damping: 18 }}
          aria-label="Notifications"
          className="glass-tint relative flex h-11 w-11 items-center justify-center rounded-2xl"
        >
          <Bell size={19} className="text-white" />
          <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-acc-pink ring-2 ring-[#0b0e16]" />
        </motion.button>
      </div>
    </motion.header>
  );
}