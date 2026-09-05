import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";

import Backdrop from "./components/Backdrop";
import PhoneFrame from "./components/PhoneFrame";
import StatusBar from "./components/StatusBar";
import TabBar from "./components/TabBar";
import AuthScreen from "./components/auth/AuthScreen.jsx";
import HomeScreen from "./screens/HomeScreen.jsx";
import ActivityScreen from "./screens/ActivityScreen.jsx";
import NutritionScreen from "./screens/NutritionScreen.jsx";
import ProfileScreen from "./screens/ProfileScreen.jsx";
import { AuthProvider, useAuth } from "./lib/auth.jsx";
import { SPRING_SNAPPY } from "./lib/motion.jsx";

const screenVariants = {
  enter: (dir) => ({ opacity: 0, x: dir > 0 ? 48 : -48, scale: 0.99 }),
  center: { opacity: 1, x: 0, scale: 1, transition: SPRING_SNAPPY },
  exit: (dir) => ({ opacity: 0, x: dir > 0 ? -48 : 48, scale: 0.99, transition: { duration: 0.18 } }),
};

const TAB_ORDER = ["home", "activity", "add", "nutrition", "profile"];

function AppShell() {
  const [activeTab, setActiveTab] = useState("home");
  const [direction, setDirection] = useState(1);
  const [addSignal, setAddSignal] = useState({ tab: null, nonce: 0 });

  const goTo = (id) => {
    setDirection(TAB_ORDER.indexOf(id) - TAB_ORDER.indexOf(activeTab));
    setActiveTab(id);
  };

  const handleAdd = () => {
    const target = activeTab === "nutrition" ? "nutrition" : "activity";
    if (activeTab !== target) goTo(target);
    setAddSignal({ tab: target, nonce: Date.now() });
  };

  let screen;
  if (activeTab === "home") screen = <HomeScreen onGoToActivity={() => goTo("activity")} />;
  else if (activeTab === "activity")
    screen = <ActivityScreen autoOpenAdd={addSignal.tab === "activity" ? addSignal.nonce : 0} />;
  else if (activeTab === "nutrition")
    screen = <NutritionScreen autoOpenAdd={addSignal.tab === "nutrition" ? addSignal.nonce : 0} />;
  else screen = <ProfileScreen />;

  return (
    <PhoneFrame>
      <StatusBar />
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
            {screen}
          </motion.div>
        </AnimatePresence>
      </div>
      <TabBar active={activeTab} onChange={goTo} onAdd={handleAdd} />
    </PhoneFrame>
  );
}

function Gate() {
  const { status } = useAuth();

  if (status === "loading") {
    return (
      <PhoneFrame>
        <div className="flex flex-1 items-center justify-center">
          <Loader2 size={28} className="animate-spin text-ink/40" />
        </div>
      </PhoneFrame>
    );
  }

  if (status === "guest") {
    return (
      <PhoneFrame>
        <div className="flex flex-1 flex-col">
          <AuthScreen />
        </div>
      </PhoneFrame>
    );
  }

  return <AppShell />;
}

export default function App() {
  return (
    <AuthProvider>
      <div className="relative flex min-h-screen w-full items-center justify-center py-8">
        <Backdrop />

        <div className="pointer-events-none absolute left-8 top-8 z-10 hidden xl:block">
          <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-ink/30">Fit Pocket</p>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.03em] text-ink/70">
            Fitness · Nutrition · Budget
          </h1>
          <p className="mt-2 max-w-[260px] text-sm leading-relaxed text-ink/35">
            One pocket for your workouts, meals, and money.
          </p>
        </div>

        <Gate />
      </div>
    </AuthProvider>
  );
}
