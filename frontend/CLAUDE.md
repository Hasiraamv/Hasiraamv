# Fitness Tracker UI — Claude Code Project Context

A native-feeling iOS/macOS-style fitness tracking mobile app dashboard built with **React + Tailwind CSS v4 + Framer Motion**.

> **Sharing with Claude Code:** `claude-code-handoff.md` at the project root is a self-contained, paste-into-chat dump of every source file (paths + full contents) with setup instructions. Regenerate it anytime with `python3 scripts/generate-handoff.py`.

## Quick Start
```bash
npm install        # if node_modules missing
npm run dev        # → http://localhost:5173
npm run build      # production build → dist/
npm run lint       # oxlint (0 errors currently)
```

## Stack
- **Vite 8** + React 19 (`@vitejs/plugin-react`)
- **Tailwind CSS v4** via `@tailwindcss/vite` plugin — **CSS-first config** in `src/index.css` (`@import "tailwindcss"` + `@theme`). There is **no `tailwind.config.js`** — do not create one.
- **Framer Motion 13** for all animations
- **lucide-react** for icons

## Design System (maintain these conventions)
- **`src/index.css`** holds all design tokens in `@theme`: SF Pro system font stack (`--font-sans`), 8px-grid spacing scale (`--spacing-*`), brand/ring/accent color tokens (`--color-brand-*`, `--color-ring-*`, `--color-acc-*`).
- Custom utilities defined with `@utility`: `glass`, `glass-strong`, `glass-tint` (backdrop-blur glassmorphism variants), `no-scrollbar`, `text-balance`.
- **8px grid**: use spacing values in 8px increments (8/16/24/32/40...) for paddings, gaps, radii. Card radius ~`rounded-[32px]` or `rounded-3xl`.
- Colors: dark theme base `#0b0e16` (screen), `#05060a` (page bg). Accents: `acc-lime #c8f31d`, `acc-orange #ff7a3c`, `acc-pink #ff4d8d`, `acc-violet #8b5cf6`, `acc-cyan #22d3ee`. Apple Fitness ring colors: `ring-move #fa5c37`, `ring-exercise #8aff5c`, `ring-stand #55aef7`.

## Architecture
```
src/
  main.jsx                 — entry, renders <App/>
  App.jsx                  — root: Backdrop + PhoneFrame + tab switching (AnimatePresence)
  index.css                — Tailwind v4 @theme tokens + @utility glass + keyframes
  lib/
    motion.jsx             — shared Framer Motion presets: SPRING_SOFT/SNAPPY/BOUNCY,
                             staggerContainer, fadeUp, fadeIn, <Stagger> wrapper
  components/
    Backdrop.jsx           — ambient drifting gradient blobs + film grain (fixed, behind phone)
    PhoneFrame.jsx         — iPhone-style 400×820 shell, Dynamic Island, bezel gloss
    StatusBar.jsx          — iOS time + signal/wifi/battery
    Header.jsx             — greeting, date, streak badge, notification bell
    ActivityRings.jsx      — Apple Fitness-style SVG rings, animates via `animate()` on inView
    TodayWorkout.jsx       — featured HIIT card with pulsing play button
    QuickStats.jsx         — 4 stat tiles (steps/HR/active min/streak)
    WeeklyChart.jsx        — staggered animated bar chart
    WorkoutCategories.jsx  — horizontal scroll chips
    RecentActivity.jsx     — glass list rows, staggered slide-in
    TabBar.jsx             — glass bottom nav, layoutId spring pill, FAB w/ tooltip
```

## Key Implementation Notes
- **Spring physics presets** live in `src/lib/motion.jsx` — use these instead of inline spring configs. `SPRING_BOUNCY` is used for the tab pill (`layoutId="tab-pill"`).
- **Ring/chart animation pattern**: `useInView(ref, { once: true })` + Framer Motion's `animate()` with easing `[0.34, 1.56, 0.64, 1]` (spring-like overshoot).
- **Tab switching**: `AnimatePresence mode="wait"` + direction-aware `screenVariants` in `App.jsx`, keyed by tab id. The "add" tab is a FAB, not a screen — `handleChange` maps it through the `order` array.
- **Tab content**: only `home` is fully built. `activity`/`explore`/`profile` are `PlaceholderScreen`s. Extend by replacing entries in the `TABS` object.
- **File extensions**: `.jsx` everywhere JSX is present (Vite 8 / rolldown refuses JSX in `.js` files).

## Status
- `npm run build` ✅ passes (2249 modules, ~111 kB gzipped JS)
- `npm run lint` ✅ 0 errors (6 informational `react(only-export-components)` fast-refresh warnings on `lib/motion.jsx` — accepted, do not "fix" by splitting unless asked)
- Verified rendering in browser via DOM inspection (all content/components mount).

## Suggested Next Steps (unimplemented)
- Build real Activity / Explore / Profile screens (replace `PlaceholderScreen`)
- Add a workout logging modal for the FAB (`TabBar.jsx` `FAB` component)
- Wire stats/rings to mock API or local state instead of hardcoded constants
- Add `prefers-reduced-motion` guards beyond backdrop blobs (Framer Motion has `useReducedMotion`)
- Make time/date in `Header.jsx`/`StatusBar.jsx` dynamic instead of hardcoded