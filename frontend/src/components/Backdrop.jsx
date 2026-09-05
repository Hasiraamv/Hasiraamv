import { motion } from "framer-motion";
import { SPRING_SOFT } from "../lib/motion.jsx";

/**
 * Ambient animated background — soft gradient blobs drifting slowly
 * behind the phone frame, giving depth for glassmorphism to blur.
 */
export default function Backdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 overflow-hidden"
    >
      {/* Base gradient wash */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#10141f] via-[#0b0e16] to-[#05060a]" />

      {/* Drifting blobs */}
      <div className="animated-blob absolute -top-32 -left-24 h-[480px] w-[480px] rounded-full bg-[radial-gradient(circle,rgba(255,122,60,0.34),transparent_70%)] blur-3xl" />
      <div
        className="animated-blob absolute top-[28%] -right-32 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(139,92,246,0.32),transparent_70%)] blur-3xl"
        style={{ animationDelay: "-5s" }}
      />
      <div
        className="animated-blob absolute bottom-[-10%] left-[18%] h-[460px] w-[460px] rounded-full bg-[radial-gradient(circle,rgba(34,211,238,0.22),transparent_70%)] blur-3xl"
        style={{ animationDelay: "-10s" }}
      />
      <div
        className="animated-blob absolute top-[45%] left-[8%] h-[300px] w-[300px] rounded-full bg-[radial-gradient(circle,rgba(255,77,141,0.2),transparent_70%)] blur-3xl"
        style={{ animationDelay: "-8s" }}
      />

      {/* Fine grain */}
      <div
        className="absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      {/* Entrance fade */}
      <motion.div
        className="absolute inset-0 bg-black/40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0 }}
        transition={SPRING_SOFT}
      />
    </div>
  );
}