import { motion } from "framer-motion";

/* Shared spring-physics presets (native macOS/iOS feel) */

export const SPRING_SOFT = {
  type: "spring",
  stiffness: 140,
  damping: 20,
  mass: 0.9,
};

export const SPRING_SNAPPY = {
  type: "spring",
  stiffness: 360,
  damping: 26,
  mass: 0.7,
};

export const SPRING_BOUNCY = {
  type: "spring",
  stiffness: 420,
  damping: 16,
  mass: 0.6,
};

/* Parent container that staggers its children on enter */
export const staggerContainer = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.1,
    },
  },
};

/* Child fade-up entrance */
export const fadeUp = {
  hidden: { opacity: 0, y: 24, scale: 0.98 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: SPRING_SOFT,
  },
};

/* Child fade-in  */
export const fadeIn = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { duration: 0.4, ease: "easeOut" },
  },
};

/* Reusable Motion component for stagger entrance */
export function Stagger({ children, className, ...rest }) {
  return (
    <motion.div
      className={className}
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      {...rest}
    >
      {children}
    </motion.div>
  );
}