import { motion } from "framer-motion";
import { SPRING_SOFT } from "../lib/motion.jsx";

/**
 * iPhone-style device frame — rounded bezel, Dynamic-Island style
 * notch, iOS status bar, and a Home Indicator inset at the bottom.
 */
export default function PhoneFrame({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 32, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={SPRING_SOFT}
      className="relative h-[820px] w-[400px] shrink-0 select-none overflow-hidden rounded-[56px] border border-white/12 bg-black shadow-[0_50px_100px_-20px_rgba(0,0,0,0.7),0_0_0_1px_rgba(255,255,255,0.06),inset_0_0_0_2px_rgba(255,255,255,0.04)]"
      style={{
        WebkitMaskImage: "radial-gradient(ellipse at center, black 55%, transparent 100%)",
      }}
    >
      {/* Bezel gloss */}
      <div className="pointer-events-none absolute inset-0 z-30 rounded-[56px] ring-1 ring-inset ring-white/10" />

      {/* Screen */}
      <div className="relative z-10 flex h-full w-full flex-col bg-gradient-to-b from-[#eaf4ff] to-[#ffffff]">
        {/* Dynamic Island / notch */}
        <div className="absolute left-1/2 top-2.5 z-40 h-[30px] w-[110px] -translate-x-1/2 rounded-full bg-black shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
          <div className="absolute right-3.5 top-1/2 h-[10px] w-[10px] -translate-y-1/2 rounded-full bg-[#1b2030]" />
        </div>

        {children}
      </div>
    </motion.div>
  );
}