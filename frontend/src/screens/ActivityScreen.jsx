import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Dumbbell, Plus, Trash2, Loader2 } from "lucide-react";
import { api } from "../lib/api";
import { Stagger, fadeUp, SPRING_SNAPPY } from "../lib/motion.jsx";
import Sheet from "../components/Sheet.jsx";
import { Label, Input, PrimaryButton } from "../components/FormField.jsx";

function emptySet() {
  return { exercise_name: "", reps: "", weight_kg: "" };
}

function AddWorkoutForm({ onDone }) {
  const [name, setName] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [sets, setSets] = useState([emptySet()]);
  const [saving, setSaving] = useState(false);

  const updateSet = (i, key, value) =>
    setSets((prev) => prev.map((s, idx) => (idx === i ? { ...s, [key]: value } : s)));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.workouts.create({
        name,
        date,
        sets: sets
          .filter((s) => s.exercise_name.trim())
          .map((s, idx) => ({
            exercise_name: s.exercise_name.trim(),
            set_order: idx + 1,
            reps: s.reps ? Number(s.reps) : undefined,
            weight_kg: s.weight_kg ? Number(s.weight_kg) : undefined,
          })),
      });
      onDone();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 pb-2">
      <div>
        <Label>Workout name</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Push Day"
          required
        />
      </div>
      <div>
        <Label>Date</Label>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      </div>

      <div>
        <Label>Sets</Label>
        <div className="flex flex-col gap-2">
          {sets.map((s, i) => (
            <div key={i} className="flex gap-2">
              <Input
                className="flex-1"
                placeholder="Exercise"
                value={s.exercise_name}
                onChange={(e) => updateSet(i, "exercise_name", e.target.value)}
              />
              <Input
                className="w-20 shrink-0 text-center"
                placeholder="#"
                inputMode="numeric"
                value={s.reps}
                onChange={(e) => updateSet(i, "reps", e.target.value)}
              />
              <Input
                className="w-20 shrink-0 text-center"
                placeholder="kg"
                inputMode="decimal"
                value={s.weight_kg}
                onChange={(e) => updateSet(i, "weight_kg", e.target.value)}
              />
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setSets((prev) => [...prev, emptySet()])}
          className="mt-2 text-[13px] font-semibold text-brand-300"
        >
          + Add set
        </button>
      </div>

      <PrimaryButton type="submit" disabled={saving} className="mt-2">
        {saving ? <Loader2 size={18} className="animate-spin" /> : "Save Workout"}
      </PrimaryButton>
    </form>
  );
}

export default function ActivityScreen({ autoOpenAdd }) {
  const [workouts, setWorkouts] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const load = () => {
    api.workouts.list().then((d) => setWorkouts(d.workouts));
  };

  useEffect(load, []);
  useEffect(() => {
    if (autoOpenAdd) setSheetOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenAdd]);

  const remove = async (id) => {
    await api.workouts.remove(id);
    load();
  };

  return (
    <Stagger className="flex flex-col gap-5 px-8 pb-24 pt-2">
      <motion.div variants={fadeUp} className="flex items-center justify-between">
        <h1 className="text-[22px] font-bold tracking-[-0.02em] text-ink">Workouts</h1>
        <motion.button
          whileTap={{ scale: 0.94 }}
          transition={SPRING_SNAPPY}
          onClick={() => setSheetOpen(true)}
          className="glass-tint flex h-10 w-10 items-center justify-center rounded-2xl text-ink"
        >
          <Plus size={18} />
        </motion.button>
      </motion.div>

      {workouts === null && (
        <motion.div variants={fadeUp} className="flex justify-center py-12 text-ink/40">
          <Loader2 size={22} className="animate-spin" />
        </motion.div>
      )}

      {workouts?.length === 0 && (
        <motion.div
          variants={fadeUp}
          className="glass-tint flex flex-col items-center gap-3 rounded-[28px] px-6 py-10 text-center"
        >
          <Dumbbell size={28} className="text-ink/30" />
          <p className="text-[14px] font-semibold text-ink/70">No workouts yet</p>
          <p className="max-w-[200px] text-[12px] text-ink/40">
            Tap + to log your first workout.
          </p>
        </motion.div>
      )}

      <div className="flex flex-col gap-3">
        {workouts?.map((w) => (
          <motion.div
            key={w.id}
            variants={fadeUp}
            className="glass flex items-center gap-4 rounded-[24px] px-5 py-4"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-acc-lime/12">
              <Dumbbell size={20} className="text-acc-lime" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-[14px] font-semibold text-ink">{w.name}</span>
              <span className="text-[12px] font-medium text-ink/45">
                {w.date}
                {w.duration_minutes ? ` · ${w.duration_minutes} min` : ""}
              </span>
            </div>
            <button
              onClick={() => remove(w.id)}
              aria-label="Delete workout"
              className="shrink-0 text-ink/25"
            >
              <Trash2 size={16} />
            </button>
          </motion.div>
        ))}
      </div>

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Log Workout">
        <AddWorkoutForm
          onDone={() => {
            setSheetOpen(false);
            load();
          }}
        />
      </Sheet>
    </Stagger>
  );
}
