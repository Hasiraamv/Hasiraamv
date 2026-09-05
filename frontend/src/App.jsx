import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Sparkles } from "lucide-react";

import Backdrop from "./components/Backdrop";
import TabBar from "./components/TabBar";
import AuthScreen from "./components/auth/AuthScreen.jsx";
import CoachSheet from "./components/CoachSheet.jsx";
import HomeScreen from "./screens/HomeScreen.jsx";
import ActivityScreen from "./screens/ActivityScreen.jsx";
import NutritionScreen from "./screens/NutritionScreen.jsx";
import ProfileScreen from "./screens/ProfileScreen.jsx";
import { AuthProvider, useAuth } from "./lib/auth.jsx";
import { SPRING_SNAPPY } from "./lib/motion.jsx";

const screenVariants = {
  enter: (dir) => ({ opacity: 0, x: dir > 0 ? 24 : -24 }),
  center: { opacity: 1, x: 0, transition: SPRING_SNAPPY },
  exit: (dir) => ({ opacity: 0, x: dir > 0 ? -24 : 24, transition: { duration: 0.15 } }),
};

const TAB_ORDER = ["home", "activity", "add", "nutrition", "profile"];

function AppShell() {
  const [activeTab, setActiveTab] = useState("home");
  const [direction, setDirection] = useState(1);
  const [addSignal, setAddSignal] = useState({ tab: null, nonce: 0 });
  const [coachOpen, setCoachOpen] = useState(false);

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
    <div className="relative flex min-h-screen w-full flex-col bg-transparent">
      <div className="no-scrollbar relative z-10 flex-1 overflow-y-auto pb-28 pt-6">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={activeTab}
            custom={direction}
            variants={screenVariants}
            initial="enter"
            animate="center"
            exit="exit"
          >
            {screen}
          </motion.div>
        </AnimatePresence>
      </div>

      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        whileTap={{ scale: 0.92 }}
        transition={SPRING_SNAPPY}
        onClick={() => setCoachOpen(true)}
        aria-label="Open AI Coach"
        className="fixed bottom-28 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-ink text-white shadow-[0_8px_24px_rgba(16,20,31,0.35)] sm:right-8"
      >
        <Sparkles size={22} />
      </motion.button>

      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-lg">
        <TabBar active={activeTab} onChange={goTo} onAdd={handleAdd} />
      </div>

      <CoachSheet open={coachOpen} onClose={() => setCoachOpen(false)} />
    </div>
  );
}

function Gate() {
  const { status } = useAuth();

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 size={28} className="animate-spin text-ink/40" />
      </div>
    );
  }

  if (status === "guest") {
    return (
      <div className="flex min-h-screen flex-col justify-center py-10">
        <AuthScreen />
      </div>
    );
  }

  return <AppShell />;
}

export default function App() {
  return (
    <AuthProvider>
      <div className="relative min-h-screen w-full">
        <Backdrop />
        <div className="relative z-10 mx-auto w-full max-w-lg">
          <Gate />
        </div>
      </div>
    </AuthProvider>
  );
}
