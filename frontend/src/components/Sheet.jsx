import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { SPRING_SNAPPY } from "../lib/motion.jsx";

export default function Sheet({ open, onClose, title, children }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 z-50 bg-black/60"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={SPRING_SNAPPY}
            className="glass-strong absolute inset-x-0 bottom-0 z-50 flex max-h-[85%] flex-col rounded-t-[32px] px-6 pb-8 pt-4"
          >
            <div className="mx-auto mb-4 h-1 w-10 shrink-0 rounded-full bg-white/20" />
            <div className="mb-4 flex shrink-0 items-center justify-between">
              <h2 className="text-[17px] font-bold tracking-[-0.02em] text-white">
                {title}
              </h2>
              <button
                onClick={onClose}
                aria-label="Close"
                className="glass-tint flex h-8 w-8 items-center justify-center rounded-full text-white/60"
              >
                <X size={16} />
              </button>
            </div>
            <div className="no-scrollbar flex-1 overflow-y-auto">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
