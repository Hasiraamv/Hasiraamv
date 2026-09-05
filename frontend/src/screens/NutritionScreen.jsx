import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Apple, Plus, Trash2, Loader2 } from "lucide-react";
import { api } from "../lib/api";
import { Stagger, fadeUp, SPRING_SNAPPY } from "../lib/motion.jsx";
import Sheet from "../components/Sheet.jsx";
import { Label, Input, Select, PrimaryButton } from "../components/FormField.jsx";

const today = () => new Date().toISOString().slice(0, 10);

function AddFoodForm({ onDone }) {
  const [name, setName] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [mealType, setMealType] = useState("breakfast");
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.nutrition.addLog({
        food_name: name,
        date: today(),
        meal_type: mealType,
        calories: Number(calories),
        protein: protein ? Number(protein) : 0,
        carbs: carbs ? Number(carbs) : 0,
        fat: fat ? Number(fat) : 0,
      });
      onDone();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 pb-2">
      <div>
        <Label>Food</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Grilled chicken" required />
      </div>
      <div>
        <Label>Meal</Label>
        <Select value={mealType} onChange={(e) => setMealType(e.target.value)}>
          <option value="breakfast">Breakfast</option>
          <option value="lunch">Lunch</option>
          <option value="dinner">Dinner</option>
          <option value="snack">Snack</option>
          <option value="other">Other</option>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Calories</Label>
          <Input inputMode="numeric" value={calories} onChange={(e) => setCalories(e.target.value)} required />
        </div>
        <div>
          <Label>Protein (g)</Label>
          <Input inputMode="decimal" value={protein} onChange={(e) => setProtein(e.target.value)} />
        </div>
        <div>
          <Label>Carbs (g)</Label>
          <Input inputMode="decimal" value={carbs} onChange={(e) => setCarbs(e.target.value)} />
        </div>
        <div>
          <Label>Fat (g)</Label>
          <Input inputMode="decimal" value={fat} onChange={(e) => setFat(e.target.value)} />
        </div>
      </div>
      <PrimaryButton type="submit" disabled={saving} className="mt-2">
        {saving ? <Loader2 size={18} className="animate-spin" /> : "Log Food"}
      </PrimaryButton>
    </form>
  );
}

const MEAL_LABEL = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack", other: "Other" };

export default function NutritionScreen({ autoOpenAdd }) {
  const [logs, setLogs] = useState(null);
  const [summary, setSummary] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const load = () => {
    api.nutrition.logs({ date: today() }).then((d) => setLogs(d.logs));
    api.nutrition.summary(today()).then(setSummary);
  };

  useEffect(load, []);
  useEffect(() => {
    if (autoOpenAdd) setSheetOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenAdd]);

  const remove = async (id) => {
    await api.nutrition.removeLog(id);
    load();
  };

  const totals = summary?.totals;
  const target = summary?.targets?.daily_calories;

  return (
    <Stagger className="flex flex-col gap-5 px-8 pb-24 pt-2">
      <motion.div variants={fadeUp} className="flex items-center justify-between">
        <h1 className="text-[22px] font-bold tracking-[-0.02em] text-white">Nutrition</h1>
        <motion.button
          whileTap={{ scale: 0.94 }}
          transition={SPRING_SNAPPY}
          onClick={() => setSheetOpen(true)}
          className="glass-tint flex h-10 w-10 items-center justify-center rounded-2xl text-white"
        >
          <Plus size={18} />
        </motion.button>
      </motion.div>

      {totals && (
        <motion.div variants={fadeUp} className="glass rounded-[28px] p-6">
          <div className="flex items-baseline gap-2">
            <span className="text-[34px] font-black leading-none tracking-[-0.03em] text-white">
              {Math.round(totals.calories)}
            </span>
            <span className="text-[13px] font-semibold text-white/45">
              / {target ?? "—"} kcal today
            </span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            {[
              ["Protein", totals.protein, "#c8f31d"],
              ["Carbs", totals.carbs, "#22d3ee"],
              ["Fat", totals.fat, "#ff7a3c"],
            ].map(([label, value, color]) => (
              <div key={label} className="glass-tint rounded-2xl py-3">
                <div className="text-[15px] font-bold text-white">{Math.round(value)}g</div>
                <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color }}>
                  {label}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {logs === null && (
        <motion.div variants={fadeUp} className="flex justify-center py-8 text-white/40">
          <Loader2 size={22} className="animate-spin" />
        </motion.div>
      )}

      {logs?.length === 0 && (
        <motion.div
          variants={fadeUp}
          className="glass-tint flex flex-col items-center gap-3 rounded-[28px] px-6 py-10 text-center"
        >
          <Apple size={28} className="text-white/30" />
          <p className="text-[14px] font-semibold text-white/70">Nothing logged today</p>
          <p className="max-w-[200px] text-[12px] text-white/40">Tap + to log a meal.</p>
        </motion.div>
      )}

      <div className="flex flex-col gap-3">
        {logs?.map((l) => (
          <motion.div key={l.id} variants={fadeUp} className="glass flex items-center gap-4 rounded-[24px] px-5 py-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-acc-cyan/12">
              <Apple size={20} className="text-acc-cyan" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-[14px] font-semibold text-white">{l.food_name}</span>
              <span className="text-[12px] font-medium text-white/45">
                {MEAL_LABEL[l.meal_type] || l.meal_type} · {Math.round(l.calories)} kcal
              </span>
            </div>
            <button onClick={() => remove(l.id)} aria-label="Delete log" className="shrink-0 text-white/25">
              <Trash2 size={16} />
            </button>
          </motion.div>
        ))}
      </div>

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Log Food">
        <AddFoodForm
          onDone={() => {
            setSheetOpen(false);
            load();
          }}
        />
      </Sheet>
    </Stagger>
  );
}
