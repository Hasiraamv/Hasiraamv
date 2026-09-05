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