import os

proj = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
files = [
    "package.json",
    "index.html",
    "vite.config.js",
    "src/main.jsx",
    "src/index.css",
    "src/lib/motion.jsx",
    "src/App.jsx",
    "src/components/Backdrop.jsx",
    "src/components/PhoneFrame.jsx",
    "src/components/StatusBar.jsx",
    "src/components/Header.jsx",
    "src/components/ActivityRings.jsx",
    "src/components/TodayWorkout.jsx",
    "src/components/QuickStats.jsx",
    "src/components/WeeklyChart.jsx",
    "src/components/WorkoutCategories.jsx",
    "src/components/RecentActivity.jsx",
    "src/components/TabBar.jsx",
]

out = []
out.append("# Fitness Tracker UI — Full Source for Claude Code")
out.append("")
out.append("> A native-feeling iOS/macOS-style fitness tracking mobile app dashboard.")
out.append("> React + Tailwind CSS v4 (CSS-first config) + Framer Motion 13 + lucide-react, on Vite 8.")
out.append(">")
out.append("> **How to use with Claude Code:**")
out.append("> 1. Run `npm create vite@latest fitness-tracker-ui -- --template react`")
out.append("> 2. `cd fitness-tracker-ui && npm install`")
out.append("> 3. `npm install framer-motion lucide-react`")
out.append("> 4. `npm install -D tailwindcss @tailwindcss/vite`")
out.append("> 5. Replace the scaffolded files with each file below (paths shown in headers).")
out.append("> 6. `npm run dev` → http://localhost:5173")
out.append("")
out.append("Project-level design context (also in CLAUDE.md): SF Pro system font stack; 8px grid spacing; dark glassmorphism (`@utility glass/glass-strong/glass-tint`); spring physics presets in `src/lib/motion.jsx` (SPRING_SOFT / SPRING_SNAPPY / SPRING_BOUNCY — use these instead of inline spring configs); Apple-Fitness rings animated via `animate()` + `useInView` with overshoot easing `[0.34,1.56,0.64,1]`; tab switching via `AnimatePresence mode=\"wait\"` + direction-aware variants keyed by tab id; the \"add\" tab is a FAB, not a screen. IMPORTANT: all files with JSX must use the `.jsx` extension (Vite 8 / rolldown rejects JSX inside `.js` files).")
out.append("")

for f in files:
    path = os.path.join(proj, f)
    with open(path, "r", encoding="utf-8") as fh:
        content = fh.read()
    lang = f.rsplit(".", 1)[-1]
    if lang not in ("jsx", "js", "css", "html", "json"):
        lang = ""
    out.append("---")
    out.append(f"## `{f}`")
    out.append("")
    out.append(f"```{lang}")
    out.append(content.rstrip("\n"))
    out.append("```")
    out.append("")

result = "\n".join(out) + "\n"
with open(os.path.join(proj, "claude-code-handoff.md"), "w", encoding="utf-8") as fh:
    fh.write(result)
print(f"Wrote claude-code-handoff.md ({len(result):,} chars, {result.count(chr(10))} lines)")