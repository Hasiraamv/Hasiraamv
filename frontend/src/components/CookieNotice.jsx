import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cookie } from "lucide-react";
import { SPRING_SNAPPY } from "../lib/motion.jsx";

const KEY = "fitpocket_cookie_ack";

function alreadyAcknowledged() {
  try {
    return !!localStorage.getItem(KEY);
  } catch {
    return false;
  }
}

export default function CookieNotice() {
  const [visible, setVisible] = useState(() => !alreadyAcknowledged());

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* ignore */
    }
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          transition={SPRING_SNAPPY}
          className="glass-strong fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md items-start gap-3 rounded-[24px] p-4 sm:inset-x-auto sm:right-4"
        >
          <Cookie size={18} className="mt-0.5 shrink-0 text-acc-orange" />
          <div className="flex flex-1 flex-col gap-2">
            <p className="text-[12px] leading-relaxed text-ink/70">
              FitPocket only uses cookies necessary to keep you signed in and remember your
              preferences — no ads, no tracking. See Cookie Policy in Profile for details.
            </p>
            <button
              onClick={dismiss}
              className="self-start rounded-xl bg-acc-orange px-4 py-1.5 text-[12px] font-bold text-white"
            >
              Got it
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
