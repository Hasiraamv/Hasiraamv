import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth.jsx";
import { Stagger } from "../lib/motion.jsx";
import Header from "../components/Header.jsx";
import ActivityRings from "../components/ActivityRings.jsx";
import TodayWorkout from "../components/TodayWorkout.jsx";
import QuickStats from "../components/QuickStats.jsx";
import WeeklyChart from "../components/WeeklyChart.jsx";
import WorkoutCategories from "../components/WorkoutCategories.jsx";
import RecentActivity from "../components/RecentActivity.jsx";

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

function last7Days() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

export default function HomeScreen({ onGoToActivity }) {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState(null);
  const [workouts, setWorkouts] = useState(null);

  useEffect(() => {
    const dates = last7Days();
    api.dashboard().then(setDashboard);
    api.workouts.list({ from: dates[0], to: dates[6] }).then((d) => setWorkouts(d.workouts));
  }, []);

  const dates = last7Days();
  const today = dates[6];

  const byDate = {};
  (workouts || []).forEach((w) => {
    byDate[w.date] = (byDate[w.date] || 0) + (w.duration_minutes || 0);
  });
  const chartDays = dates.map((date) => ({
    day: DAY_LABELS[new Date(date + "T00:00:00").getDay()],
    minutes: byDate[date] || 0,
  }));
  const totalMinutes = chartDays.reduce((sum, d) => sum + d.minutes, 0);

  const todayWorkout = workouts?.find((w) => w.date === today);
  const recentItems = (workouts || [])
    .slice(0, 4)
    .map((w) => ({ id: w.id, name: w.name, date: w.date, duration_minutes: w.duration_minutes }));

  const calories = dashboard?.nutrition?.today?.calories ?? 0;
  const caloriesGoal = dashboard?.nutrition?.targets?.daily_calories ?? 2000;
  const workoutsThisWeek = dashboard?.fitness?.workouts_last_7_days ?? 0;
  const income = dashboard?.budget?.income ?? 0;
  const expenses = dashboard?.budget?.expenses ?? 0;
  const budgetLeft = Math.max(0, income - expenses);
  const budgetLeftPct = income > 0 ? budgetLeft / income : 1;

  return (
    <Stagger className="flex flex-col gap-6 pb-8">
      <Header name={user?.name} streak={workoutsThisWeek} />
      <ActivityRings
        calories={calories}
        caloriesGoal={caloriesGoal}
        workouts={workoutsThisWeek}
        budgetLeftPct={budgetLeftPct}
      />
      <TodayWorkout workout={todayWorkout} onAdd={onGoToActivity} />
      <QuickStats
        calories={calories}
        workoutsThisWeek={workoutsThisWeek}
        activeMinutes={totalMinutes}
        budgetLeft={budgetLeft}
      />
      <WeeklyChart days={chartDays} totalMinutes={totalMinutes} />
      <WorkoutCategories onSelect={onGoToActivity} />
      <RecentActivity items={recentItems} onViewAll={onGoToActivity} />
    </Stagger>
  );
}
