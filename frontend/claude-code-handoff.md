# Fitness Tracker UI — Full Source for Claude Code

> A native-feeling iOS/macOS-style fitness tracking mobile app dashboard.
> React + Tailwind CSS v4 (CSS-first config) + Framer Motion 13 + lucide-react, on Vite 8.
>
> **How to use with Claude Code:**
> 1. Run `npm create vite@latest fitness-tracker-ui -- --template react`
> 2. `cd fitness-tracker-ui && npm install`
> 3. `npm install framer-motion lucide-react`
> 4. `npm install -D tailwindcss @tailwindcss/vite`
> 5. Replace the scaffolded files with each file below (paths shown in headers).
> 6. `npm run dev` → http://localhost:5173

Project-level design context (also in CLAUDE.md): SF Pro system font stack; 8px grid spacing; dark glassmorphism (`@utility glass/glass-strong/glass-tint`); spring physics presets in `src/lib/motion.jsx` (SPRING_SOFT / SPRING_SNAPPY / SPRING_BOUNCY — use these instead of inline spring configs); Apple-Fitness rings animated via `animate()` + `useInView` with overshoot easing `[0.34,1.56,0.64,1]`; tab switching via `AnimatePresence mode="wait"` + direction-aware variants keyed by tab id; the "add" tab is a FAB, not a screen. IMPORTANT: all files with JSX must use the `.jsx` extension (Vite 8 / rolldown rejects JSX inside `.js` files).

---
## `package.json`

```json
{
  "name": "fitness-tracker-ui",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "lint": "oxlint",
    "preview": "vite preview"
  },
  "dependencies": {
    "framer-motion": "^13.2.0",
    "lucide-react": "^1.41.0",
    "react": "^19.2.8",
    "react-dom": "^19.2.8"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.3.3",
    "@types/react": "^19.2.18",
    "@types/react-dom": "^19.2.4",
    "@vitejs/plugin-react": "^6.1.0",
    "oxlint": "^1.79.0",
    "tailwindcss": "^4.3.3",
    "vite": "^8.2.2"
  }
}
```

---
## `index.html`

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, maximum-scale=1.0" />
    <meta name="theme-color" content="#0b0e14" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <title>Pulse — Fitness Tracker</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

---
## `vite.config.js`

```js
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
})
```

---
## `src/main.jsx`

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

---
## `src/index.css`

```css
@import "tailwindcss";

/* ─────────────────────────────────────────────
   Design tokens — 8px grid, SF Pro typography
   ───────────────────────────────────────────── */
@theme {
  /* SF Pro-style system font stack (primary font on Apple platforms) */
  --font-sans: -apple-system, BlinkMacSystemFont, "SF Pro Text",
    "SF Pro Display", "SF Pro", "Helvetica Neue", "Segoe UI", Roboto,
    "Inter", sans-serif;

  /* 8px grid spacing scale */
  --spacing-1: 0.125rem;   /* 2px  */
  --spacing-2: 0.25rem;    /* 2px  */
  --spacing-3: 0.375rem;   /* 6px  */
  --spacing-4: 0.5rem;     /* 8px  */
  --spacing-5: 0.625rem;   /* 10px */
  --spacing-6: 0.75rem;    /* 12px */
  --spacing-7: 0.875rem;   /* 14px */
  --spacing-8: 1rem;       /* 16px */
  --spacing-9: 1.125rem;   /* 18px */
  --spacing-10: 1.25rem;   /* 20px */
  --spacing-12: 1.5rem;    /* 24px */
  --spacing-14: 1.75rem;   /* 28px */
  --spacing-16: 2rem;      /* 32px */
  --spacing-20: 2.5rem;    /* 40px */
  --spacing-24: 3rem;      /* 48px */
  --spacing-28: 3.5rem;    /* 56px */
  --spacing-32: 4rem;      /* 64px */

  /* Custom brand palette */
  --color-brand-50:  #eef2ff;
  --color-brand-100: #dfe6ff;
  --color-brand-200: #c5d2ff;
  --color-brand-300: #a2b4ff;
  --color-brand-400: #7c8cff;
  --color-brand-500: #5b6cff;
  --color-brand-600: #3d4df0;
  --color-brand-700: #2f3ad1;
  --color-brand-800: #2931a8;
  --color-brand-900: #272e84;

  /* Apple Fitness ring colors */
  --color-ring-move: #fa5c37;
  --color-ring-exercise: #8aff5c;
  --color-ring-stand: #55aef7;

  /* Accent gradient (energetic, fitness-style) */
  --color-acc-lime: #c8f31d;
  --color-acc-orange: #ff7a3c;
  --color-acc-pink: #ff4d8d;
  --color-acc-violet: #8b5cf6;
  --color-acc-cyan: #22d3ee;
}

/* ─────────────────────────────────────────────
   Base styles
   ───────────────────────────────────────────── */
html,
body,
#root {
  height: 100%;
}

body {
  margin: 0;
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
  background: #05060a;
  overflow-x: hidden;
}

::selection {
  background: rgba(124, 140, 255, 0.35);
}

/* Custom slim scrollbars */
* {
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.16) transparent;
}
*::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
*::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.16);
  border-radius: 999px;
}
*::-webkit-scrollbar-track {
  background: transparent;
}

/* ─────────────────────────────────────────────
   Utilities
   ───────────────────────────────────────────── */
@utility glass {
  background: rgba(255, 255, 255, 0.06);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  backdrop-filter: blur(24px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.09);
}

@utility glass-strong {
  background: rgba(22, 27, 38, 0.72);
  -webkit-backdrop-filter: blur(32px) saturate(200%);
  backdrop-filter: blur(32px) saturate(200%);
  border: 1px solid rgba(255, 255, 255, 0.12);
}

@utility glass-tint {
  background: rgba(255, 255, 255, 0.14);
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.18);
}

@utility text-balance {
  text-wrap: balance;
}

@utility no-scrollbar {
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
}

/* Subtle animated gradient blobs for the ambient backdrop */
@keyframes blob-drift {
  0% {
    transform: translate(0, 0) scale(1);
  }
  33% {
    transform: translate(28px, -22px) scale(1.07);
  }
  66% {
    transform: translate(-18px, 18px) scale(0.95);
  }
  100% {
    transform: translate(0, 0) scale(1);
  }
}

.animated-blob {
  animation: blob-drift 16s ease-in-out infinite;
  will-change: transform;
}

@media (prefers-reduced-motion: reduce) {
  .animated-blob {
    animation: none;
  }
}
```

---
## `src/lib/motion.jsx`

```jsx
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
```

---
## `src/App.jsx`

```jsx
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import Backdrop from "./components/Backdrop";
import PhoneFrame from "./components/PhoneFrame";
import StatusBar from "./components/StatusBar";
import Header from "./components/Header";
import ActivityRings from "./components/ActivityRings";
import TodayWorkout from "./components/TodayWorkout";
import QuickStats from "./components/QuickStats";
import WeeklyChart from "./components/WeeklyChart";
import WorkoutCategories from "./components/WorkoutCategories";
import RecentActivity from "./components/RecentActivity";
import TabBar from "./components/TabBar";
import { Stagger, fadeUp, SPRING_SNAPPY } from "./lib/motion.jsx";

/* Tab content switch variants (native slide + spring) */
const screenVariants = {
  enter: (dir) => ({
    opacity: 0,
    x: dir > 0 ? 48 : -48,
    scale: 0.99,
  }),
  center: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: SPRING_SNAPPY,
  },
  exit: (dir) => ({
    opacity: 0,
    x: dir > 0 ? -48 : 48,
    scale: 0.99,
    transition: { duration: 0.18 },
  }),
};

/* ─── Home screen ─────────────────────────────── */
function HomeScreen() {
  return (
    <Stagger className="flex flex-col gap-6 pb-8">
      <Header />
      <ActivityRings />
      <TodayWorkout />
      <QuickStats />
      <WeeklyChart />
      <WorkoutCategories />
      <RecentActivity />
    </Stagger>
  );
}

/* ─── Placeholder screens for other tabs ─────── */
function PlaceholderScreen({ title, emoji }) {
  return (
    <Stagger className="flex flex-1 flex-col items-center justify-center gap-4 px-8 pb-24">
      <motion.div
        variants={fadeUp}
        className="glass-tint flex h-24 w-24 items-center justify-center rounded-[32px] text-5xl"
      >
        {emoji}
      </motion.div>
      <motion.h2
        variants={fadeUp}
        className="text-center text-[22px] font-bold tracking-[-0.02em] text-white"
      >
        {title}
      </motion.h2>
      <motion.p
        variants={fadeUp}
        className="max-w-[240px] text-center text-[13px] leading-relaxed text-white/45"
      >
        This screen is a placeholder in this demo. The full experience lives on
        the Home tab.
      </motion.p>
    </Stagger>
  );
}

const TABS = {
  home: <HomeScreen />,
  activity: <PlaceholderScreen title="Activity" emoji="📊" />,
  explore: <PlaceholderScreen title="Explore" emoji="🗺️" />,
  profile: <PlaceholderScreen title="Profile" emoji="👤" />,
};

export default function App() {
  const [activeTab, setActiveTab] = useState("home");
  const [direction, setDirection] = useState(1);

  const handleChange = (id) => {
    const order = ["home", "activity", "add", "explore", "profile"];
    setDirection(order.indexOf(id) - order.indexOf(activeTab));
    setActiveTab(id);
  };

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center py-8">
      <Backdrop />

      {/* Desktop side caption (hidden on small screens) */}
      <div className="pointer-events-none absolute left-8 top-8 z-10 hidden xl:block">
        <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-white/30">
          UI Concept
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-[-0.03em] text-white/70">
          Fitness Tracker
        </h1>
        <p className="mt-2 max-w-[260px] text-sm leading-relaxed text-white/35">
          A native-feeling mobile dashboard built with React, Tailwind CSS &
          Framer Motion.
        </p>
      </div>

      <PhoneFrame>
        <StatusBar />

        {/* Scrollable content area */}
        <div className="no-scrollbar relative z-10 flex-1 overflow-y-auto pt-2">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={activeTab}
              custom={direction}
              variants={screenVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="flex h-full flex-col"
            >
              {TABS[activeTab]}
            </motion.div>
          </AnimatePresence>
        </div>

        <TabBar active={activeTab} onChange={handleChange} />
      </PhoneFrame>
    </div>
  );
}
```

---
## `src/components/Backdrop.jsx`

```jsx
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
```

---
## `src/components/PhoneFrame.jsx`

```jsx
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
      <div className="relative z-10 flex h-full w-full flex-col bg-[#0b0e16]">
        {/* Dynamic Island / notch */}
        <div className="absolute left-1/2 top-2.5 z-40 h-[30px] w-[110px] -translate-x-1/2 rounded-full bg-black shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
          <div className="absolute right-3.5 top-1/2 h-[10px] w-[10px] -translate-y-1/2 rounded-full bg-[#1b2030]" />
        </div>

        {children}
      </div>
    </motion.div>
  );
}
```

---
## `src/components/StatusBar.jsx`

```jsx
import { Wifi, BatteryFull } from "lucide-react";

/**
 * iOS-style status bar — time left, system icons right.
 */
export default function StatusBar() {
  const now = new Date();
  const time = now.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).toLowerCase().replace(" ", "");

  return (
    <div className="relative z-40 flex items-center justify-between px-8 pt-4 pb-2 text-white">
      <span className="text-[15px] font-semibold tracking-[-0.01em]">
        {time}
      </span>

      <div className="flex items-center gap-1.5">
        {/* Signal bars */}
        <div className="flex items-end gap-[2px]">
          {[5, 8, 11].map((h) => (
            <span
              key={h}
              className="w-[3px] rounded-[1px] bg-white"
              style={{ height: h }}
            />
          ))}
        </div>
        <Wifi size={16} strokeWidth={2.6} className="text-white" />
        <BatteryFull size={24} strokeWidth={1.6} className="text-white" />
      </div>
    </div>
  );
}
```

---
## `src/components/Header.jsx`

```jsx
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
```

---
## `src/components/ActivityRings.jsx`

```jsx
import { useEffect, useRef, useState } from "react";
import { motion, useInView, animate } from "framer-motion";
import { fadeUp } from "../lib/motion.jsx";

const RING_SIZE = 216;
const CENTER = RING_SIZE / 2;
const MAX_RADIUS = 92;
const STROKE = 17;

/* Apple-Fitness-style rings */
const RINGS = [
  {
    key: "move",
    label: "Move",
    color: "#fa5c37",
    track: "rgba(250,92,55,0.14)",
    radius: MAX_RADIUS,
    progress: 0.78,
    value: "482",
    goal: "600 kcal",
  },
  {
    key: "exercise",
    label: "Exercise",
    color: "#8aff5c",
    track: "rgba(138,255,92,0.14)",
    radius: MAX_RADIUS - STROKE - 5,
    progress: 0.52,
    value: "26",
    goal: "50 min",
  },
  {
    key: "stand",
    label: "Stand",
    color: "#55aef7",
    track: "rgba(85,174,247,0.14)",
    radius: MAX_RADIUS - (STROKE + 5) * 2,
    progress: 0.9,
    value: "9",
    goal: "12 hrs",
  },
];

/* Polar→cartesian for SVG arc end points */
function polar(cx, cy, r, angleInDegrees) {
  const a = ((angleInDegrees - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(a),
    y: cy + r * Math.sin(a),
  };
}

/* Full circle segment path (gap at bottom like Apple rings) */
function ringPath(radius, progress) {
  const start = polar(CENTER, CENTER, radius, 135);
  const end = polar(CENTER, CENTER, radius, 135 + 270 * progress);
  const largeArc = progress > 0.5 ? 1 : 0;
  const sweep = 1;
  if (progress <= 0) return "";
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} ${sweep} ${end.x} ${end.y}`;
}

function RingSegment({
  color,
  track,
  radius,
  animatedProgress,
}) {
  const full = 270; // degrees of travel
  const circumference = (2 * Math.PI * radius * full) / 360;

  return (
    <g>
      {/* Track */}
      <path
        d={ringPath(radius, 1)}
        fill="none"
        stroke={track}
        strokeWidth={STROKE}
        strokeLinecap="round"
      />
      {/* Progress */}
      {animatedProgress > 0.01 && (
        <motion.path
          d={ringPath(radius, Math.min(animatedProgress, 1))}
          fill="none"
          stroke={color}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={`${circumference * animatedProgress} ${circumference}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          style={{
            filter: `drop-shadow(0 0 6px ${color}66)`,
          }}
        />
      )}
    </g>
  );
}

/**
 * Apple Fitness-style animated activity rings.
 * Progress animates in with spring physics on scroll-into-view.
 */
export default function ActivityRings() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const [animated, setAnimated] = useState({ move: 0, exercise: 0, stand: 0 });

  useEffect(() => {
    if (!inView) return;
    const controls = [
      animate(0, 1, {
        duration: 1.6,
        ease: [0.34, 1.56, 0.64, 1], // spring-ish overshoot
        onUpdate: (v) =>
          setAnimated((prev) => ({
            ...prev,
            move: v * RINGS[0].progress,
            exercise: v * RINGS[1].progress,
            stand: v * RINGS[2].progress,
          })),
      }),
    ];
    return () => controls.forEach((c) => c.stop());
  }, [inView]);

  return (
    <motion.div
      ref={ref}
      variants={fadeUp}
      className="glass relative flex items-center justify-center rounded-[32px] p-6"
    >
      <div className="relative">
        <svg
          width={RING_SIZE}
          height={RING_SIZE}
          viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
          className="-rotate-0"
        >
          {RINGS.map((ring) => (
            <RingSegment
              key={ring.key}
              color={ring.color}
              track={ring.track}
              radius={ring.radius}
              animatedProgress={animated[ring.key]}
            />
          ))}
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
            Today
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-[46px] font-black leading-none tracking-[-0.04em] text-white">
              482
            </span>
            <span className="text-sm font-semibold text-white/50">kcal</span>
          </div>
          <span className="mt-1 flex items-center gap-1.5 text-[12px] font-medium text-white/45">
            <span className="h-1.5 w-1.5 rounded-full bg-ring-exercise" />
            Goal: 600 kcal
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="absolute bottom-5 left-0 right-0 flex items-center justify-center gap-6">
        {RINGS.map((ring) => (
          <div key={ring.key} className="flex items-center gap-1.5">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: ring.color }}
            />
            <span className="text-[11px] font-medium text-white/50">
              {ring.value} {ring.label}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
```

---
## `src/components/TodayWorkout.jsx`

```jsx
import { Play, Clock, Flame } from "lucide-react";
import { motion } from "framer-motion";
import { fadeUp, SPRING_SNAPPY } from "../lib/motion.jsx";

export default function TodayWorkout() {
  return (
    <motion.div
      variants={fadeUp}
      className="relative overflow-hidden rounded-[32px] p-6"
      style={{
        background:
          "linear-gradient(135deg, rgba(255,122,60,0.28), rgba(255,77,141,0.2) 45%, rgba(139,92,246,0.24))",
        border: "1px solid rgba(255,255,255,0.14)",
      }}
    >
      {/* Decorative circles */}
      <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-acc-orange/20 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-8 h-40 w-40 rounded-full bg-acc-violet/20 blur-2xl" />

      <div className="relative flex items-center justify-between">
        <div className="flex flex-col gap-3">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/85 backdrop-blur-sm">
            <Flame size={12} className="text-acc-lime" />
            Today's Workout
          </span>

          <h2 className="max-w-[200px] text-[22px] font-bold leading-tight tracking-[-0.02em] text-white">
            HIIT Full Body
            <span className="text-white/55"> · Level 2</span>
          </h2>

          <div className="flex items-center gap-4 text-white/70">
            <span className="flex items-center gap-1.5 text-[12px] font-medium">
              <Clock size={14} />
              32 min
            </span>
            <span className="h-1 w-1 rounded-full bg-white/30" />
            <span className="flex items-center gap-1.5 text-[12px] font-medium">
              <Flame size={14} />
              380 kcal
            </span>
            <span className="h-1 w-1 rounded-full bg-white/30" />
            <span className="text-[12px] font-medium">8 exercises</span>
          </div>
        </div>

        {/* Circular play button */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.92 }}
          transition={SPRING_SNAPPY}
          aria-label="Start workout"
          className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white text-[#0b0e16] shadow-[0_8px_30px_rgba(255,255,255,0.25)]"
        >
          <span className="absolute inset-0 animate-ping rounded-full bg-white/30" style={{ animationDuration: "2.5s" }} />
          <Play size={26} fill="currentColor" className="ml-1" />
        </motion.button>
      </div>
    </motion.div>
  );
}
```

---
## `src/components/QuickStats.jsx`

```jsx
import { Footprints, HeartPulse, Timer, Trophy } from "lucide-react";
import { motion } from "framer-motion";
import { fadeUp } from "../lib/motion.jsx";

const STATS = [
  {
    label: "Steps",
    value: "8,482",
    sub: "+12%",
    icon: Footprints,
    color: "#22d3ee",
    bg: "rgba(34,211,238,0.12)",
  },
  {
    label: "Heart Rate",
    value: "74",
    sub: "bpm",
    icon: HeartPulse,
    color: "#ff4d8d",
    bg: "rgba(255,77,141,0.12)",
  },
  {
    label: "Active Min",
    value: "46",
    sub: "/50",
    icon: Timer,
    color: "#c8f31d",
    bg: "rgba(200,243,29,0.1)",
  },
  {
    label: "Goal Streak",
    value: "12",
    sub: "days",
    icon: Trophy,
    color: "#ffb020",
    bg: "rgba(255,176,32,0.14)",
  },
];

export default function QuickStats() {
  return (
    <div className="grid grid-cols-4 gap-3">
      {STATS.map((stat) => (
        <motion.div
          key={stat.label}
          variants={fadeUp}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          transition={{ type: "spring", stiffness: 400, damping: 20 }}
          className="glass flex flex-col items-center gap-2 rounded-3xl px-2 py-4 text-center"
        >
          <div
            className="flex h-9 w-9 items-center justify-center rounded-2xl"
            style={{ backgroundColor: stat.bg }}
          >
            <stat.icon size={18} style={{ color: stat.color }} />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[16px] font-bold leading-none tracking-[-0.02em] text-white">
              {stat.value}
            </span>
            <span className="text-[10px] font-medium leading-tight text-white/45">
              {stat.sub}
            </span>
          </div>
          <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-white/40">
            {stat.label}
          </span>
        </motion.div>
      ))}
    </div>
  );
}
```

---
## `src/components/WeeklyChart.jsx`

```jsx
import { useEffect, useRef, useState } from "react";
import { motion, useInView, animate } from "framer-motion";
import { fadeUp } from "../lib/motion.jsx";

const DAYS = [
  { day: "M", value: 0.45 },
  { day: "T", value: 0.7 },
  { day: "W", value: 0.55 },
  { day: "T", value: 0.85 },
  { day: "F", value: 0.6 },
  { day: "S", value: 0.95 },
  { day: "S", value: 0.35 },
];

const GRADIENT = [
  "linear-gradient(180deg, #22d3ee, #5b6cff)",
  "linear-gradient(180deg, #8b5cf6, #5b6cff)",
  "linear-gradient(180deg, #ff7a3c, #ff4d8d)",
];

export default function WeeklyChart() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const [heights, setHeights] = useState(() => DAYS.map(() => 0));

  useEffect(() => {
    if (!inView) return;
    const controls = DAYS.map((d, i) =>
      animate(0, d.value, {
        duration: 0.9,
        delay: i * 0.06,
        ease: [0.34, 1.56, 0.64, 1],
        onUpdate: (v) =>
          setHeights((prev) => {
            const next = [...prev];
            next[i] = v;
            return next;
          }),
      })
    );
    return () => controls.forEach((c) => c.stop());
  }, [inView]);

  return (
    <motion.div
      ref={ref}
      variants={fadeUp}
      className="glass rounded-[32px] p-6"
    >
      <div className="mb-5 flex items-end justify-between">
        <div>
          <h2 className="text-[17px] font-bold tracking-[-0.02em] text-white">
            Weekly Activity
          </h2>
          <p className="mt-0.5 text-[12px] font-medium text-white/45">
            4,520 kcal burned this week
          </p>
        </div>
        <span className="rounded-full bg-white/8 px-3 py-1 text-[11px] font-semibold text-white/60">
          Last 7 days
        </span>
      </div>

      <div className="flex h-32 items-end justify-between gap-3">
        {DAYS.map((d, i) => (
          <div
            key={`${d.day}-${i}`}
            className="flex h-full w-full flex-col items-center justify-end gap-2"
          >
            <div className="flex h-full w-full items-end justify-center">
              <div
                className="relative w-3.5 rounded-full"
                style={{
                  height: `${Math.max(heights[i] * 100, 4)}%`,
                  background: GRADIENT[i % GRADIENT.length],
                  opacity: 0.35 + 0.65 * heights[i],
                  boxShadow: heights[i] > 0.8 ? "0 0 12px rgba(91,108,255,0.5)" : "none",
                }}
              >
                {i === 5 && (
                  <span className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
                    95%
                  </span>
                )}
              </div>
            </div>
            <span
              className={`text-[11px] font-semibold ${
                i === 5 ? "text-brand-300" : "text-white/40"
              }`}
            >
              {d.day}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
```

---
## `src/components/WorkoutCategories.jsx`

```jsx
import { Dumbbell, Footprints, Bike, Waves, Flame, HeartPulse } from "lucide-react";
import { motion } from "framer-motion";
import { fadeUp, SPRING_SNAPPY } from "../lib/motion.jsx";

const CATEGORIES = [
  { label: "Strength", icon: Dumbbell, color: "#c8f31d" },
  { label: "Running", icon: Footprints, color: "#22d3ee" },
  { label: "Cycling", icon: Bike, color: "#5b6cff" },
  { label: "Swimming", icon: Waves, color: "#55aef7" },
  { label: "HIIT", icon: Flame, color: "#ff7a3c" },
  { label: "Yoga", icon: HeartPulse, color: "#ff4d8d" },
];

export default function WorkoutCategories() {
  return (
    <motion.div variants={fadeUp} className="flex flex-col gap-3">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-[17px] font-bold tracking-[-0.02em] text-white">
          Workouts
        </h2>
        <button className="text-[13px] font-semibold text-brand-300">
          See all
        </button>
      </div>

      <div className="no-scrollbar -mx-8 flex gap-3 overflow-x-auto px-8 pb-1">
        {CATEGORIES.map((cat) => (
          <motion.button
            key={cat.label}
            whileHover={{ y: -2, scale: 1.04 }}
            whileTap={{ scale: 0.95 }}
            transition={SPRING_SNAPPY}
            className="glass flex shrink-0 flex-col items-center gap-2 rounded-3xl px-5 py-4"
          >
            <div
              className="flex h-11 w-11 items-center justify-center rounded-2xl"
              style={{ backgroundColor: `${cat.color}1f` }}
            >
              <cat.icon size={20} style={{ color: cat.color }} />
            </div>
            <span className="text-[12px] font-semibold text-white/80">
              {cat.label}
            </span>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}
```

---
## `src/components/RecentActivity.jsx`

```jsx
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
```

---
## `src/components/TabBar.jsx`

```jsx
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
```

