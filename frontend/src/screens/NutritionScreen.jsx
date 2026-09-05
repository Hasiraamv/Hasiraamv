import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Apple, Plus, Trash2, Loader2, Camera, Droplet, Moon } from "lucide-react";
import { api } from "../lib/api";
import { Stagger, fadeUp, SPRING_SNAPPY } from "../lib/motion.jsx";
import Sheet from "../components/Sheet.jsx";
import { Label, Input, Select, PrimaryButton } from "../components/FormField.jsx";

const today = () => new Date().toISOString().slice(0, 10);

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function AddFoodForm({ onDone, initial }) {
  const [name, setName] = useState(initial?.food_name ?? "");
  const [calories, setCalories] = useState(initial?.calories != null ? String(Math.round(initial.calories)) : "");
  const [protein, setProtein] = useState(initial?.protein != null ? String(Math.round(initial.protein)) : "");
  const [carbs, setCarbs] = useState(initial?.carbs != null ? String(Math.round(initial.carbs)) : "");
  const [fat, setFat] = useState(initial?.fat != null ? String(Math.round(initial.fat)) : "");
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
      {initial && (
        <div className="glass-tint flex items-center gap-2 rounded-xl px-3 py-2 text-[12px] font-medium text-ink/60">
          <Camera size={14} className="text-acc-violet" />
          AI estimate from your photo — check it before saving.
        </div>
      )}
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
const WATER_QUICK_ADD = [250, 500, 750];

function WaterCard({ waterMl, waterTarget, onAdd }) {
  const pct = waterTarget ? Math.min(1, waterMl / waterTarget) : 0;
  return (
    <motion.div variants={fadeUp} className="glass rounded-[28px] p-6">
      <div className="mb-3 flex items-center justify-between">
        <span className="flex items-center gap-2 text-[13px] font-semibold text-ink/70">
          <Droplet size={16} className="text-acc-cyan" />
          Water
        </span>
        <span className="text-[13px] font-semibold text-ink/50">
          {waterMl}ml{waterTarget ? ` / ${waterTarget}ml` : ""}
        </span>
      </div>
      {waterTarget && (
        <div className="mb-4 h-2 overflow-hidden rounded-full bg-ink/8">
          <div className="h-full rounded-full bg-acc-cyan transition-all" style={{ width: `${pct * 100}%` }} />
        </div>
      )}
      <div className="flex gap-2">
        {WATER_QUICK_ADD.map((ml) => (
          <button
            key={ml}
            onClick={() => onAdd(ml)}
            className="glass-tint flex-1 rounded-xl py-2 text-[13px] font-semibold text-ink"
          >
            +{ml}ml
          </button>
        ))}
      </div>
    </motion.div>
  );
}

const SLEEP_QUICK_LOG = [6, 7, 8, 9];

function SleepCard({ hours, target = 8, onLog }) {
  const pct = hours ? Math.min(1, hours / target) : 0;
  return (
    <motion.div variants={fadeUp} className="glass rounded-[28px] p-6">
      <div className="mb-3 flex items-center justify-between">
        <span className="flex items-center gap-2 text-[13px] font-semibold text-ink/70">
          <Moon size={16} className="text-acc-violet" />
          Sleep
        </span>
        <span className="text-[13px] font-semibold text-ink/50">
          {hours ? `${hours}h` : "Not logged"} / {target}h
        </span>
      </div>
      <div className="mb-4 h-2 overflow-hidden rounded-full bg-ink/8">
        <div className="h-full rounded-full bg-acc-violet transition-all" style={{ width: `${pct * 100}%` }} />
      </div>
      <div className="flex gap-2">
        {SLEEP_QUICK_LOG.map((h) => (
          <button
            key={h}
            onClick={() => onLog(h)}
            className={`flex-1 rounded-xl py-2 text-[13px] font-semibold transition-colors ${
              hours === h ? "bg-acc-violet text-white" : "glass-tint text-ink"
            }`}
          >
            {h}h
          </button>
        ))}
      </div>
    </motion.div>
  );
}

export default function NutritionScreen({ autoOpenAdd }) {
  const [logs, setLogs] = useState(null);
  const [summary, setSummary] = useState(null);
  const [water, setWater] = useState(null);
  const [sleep, setSleep] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [scanPrefill, setScanPrefill] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState(null);
  const fileInputRef = useRef(null);

  const load = () => {
    api.nutrition.logs({ date: today() }).then((d) => setLogs(d.logs));
    api.nutrition.summary(today()).then(setSummary);
    api.nutrition.water(today()).then(setWater);
    api.nutrition.sleep(today()).then((d) => setSleep(d.log));
  };

  useEffect(load, []);
  useEffect(() => {
    if (autoOpenAdd) {
      setScanPrefill(null);
      setSheetOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenAdd]);

  const remove = async (id) => {
    await api.nutrition.removeLog(id);
    load();
  };

  const addWater = async (ml) => {
    await api.nutrition.addWater({ amount_ml: ml, date: today() });
    load();
  };

  const logSleep = async (hours) => {
    await api.nutrition.logSleep({ hours, date: today() });
    load();
  };

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setScanError(null);
    setScanning(true);
    try {
      const base64 = await fileToBase64(file);
      const suggestion = await api.ai.scanFood(base64);
      setScanPrefill(suggestion);
      setSheetOpen(true);
    } catch (err) {
      setScanError(err.message || "Could not read that photo.");
    } finally {
      setScanning(false);
    }
  };

  const totals = summary?.totals;
  const target = summary?.targets?.daily_calories;

  return (
    <Stagger className="flex flex-col gap-5 px-8 pb-24 pt-2">
      <motion.div variants={fadeUp} className="flex items-center justify-between">
        <h1 className="text-[22px] font-bold tracking-[-0.02em] text-ink">Nutrition</h1>
        <div className="flex items-center gap-2">
          <motion.button
            whileTap={{ scale: 0.94 }}
            transition={SPRING_SNAPPY}
            onClick={() => fileInputRef.current?.click()}
            disabled={scanning}
            aria-label="Scan food photo"
            className="glass-tint flex h-10 w-10 items-center justify-center rounded-2xl text-ink"
          >
            {scanning ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.94 }}
            transition={SPRING_SNAPPY}
            onClick={() => {
              setScanPrefill(null);
              setSheetOpen(true);
            }}
            aria-label="Add food manually"
            className="glass-tint flex h-10 w-10 items-center justify-center rounded-2xl text-ink"
          >
            <Plus size={18} />
          </motion.button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handlePhoto}
          />
        </div>
      </motion.div>

      {scanError && (
        <motion.p variants={fadeUp} className="rounded-xl bg-acc-pink/10 px-4 py-2.5 text-[12px] font-medium text-acc-pink">
          {scanError}
        </motion.p>
      )}

      {totals && (
        <motion.div variants={fadeUp} className="glass rounded-[28px] p-6">
          <div className="flex items-baseline gap-2">
            <span className="text-[34px] font-black leading-none tracking-[-0.03em] text-ink">
              {Math.round(totals.calories)}
            </span>
            <span className="text-[13px] font-semibold text-ink/45">
              / {target ?? "—"} kcal today
            </span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            {[
              ["Protein", totals.protein, "#7bc142"],
              ["Carbs", totals.carbs, "#22a9d4"],
              ["Fat", totals.fat, "#ff7a00"],
            ].map(([label, value, color]) => (
              <div key={label} className="glass-tint rounded-2xl py-3">
                <div className="text-[15px] font-bold text-ink">{Math.round(value)}g</div>
                <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color }}>
                  {label}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      <WaterCard
        waterMl={water?.total_ml ?? 0}
        waterTarget={summary?.targets?.daily_water_ml}
        onAdd={addWater}
      />

      <SleepCard
        hours={sleep?.hours}
        target={summary?.targets?.daily_sleep_hours ?? 8}
        onLog={logSleep}
      />

      {logs === null && (
        <motion.div variants={fadeUp} className="flex justify-center py-8 text-ink/40">
          <Loader2 size={22} className="animate-spin" />
        </motion.div>
      )}

      {logs?.length === 0 && (
        <motion.div
          variants={fadeUp}
          className="glass-tint flex flex-col items-center gap-3 rounded-[28px] px-6 py-10 text-center"
        >
          <Apple size={28} className="text-ink/30" />
          <p className="text-[14px] font-semibold text-ink/70">Nothing logged today</p>
          <p className="max-w-[200px] text-[12px] text-ink/40">Tap + to log a meal, or the camera to scan one.</p>
        </motion.div>
      )}

      <div className="flex flex-col gap-3">
        {logs?.map((l) => (
          <motion.div key={l.id} variants={fadeUp} className="glass flex items-center gap-4 rounded-[24px] px-5 py-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-acc-cyan/12">
              <Apple size={20} className="text-acc-cyan" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-[14px] font-semibold text-ink">{l.food_name}</span>
              <span className="text-[12px] font-medium text-ink/45">
                {MEAL_LABEL[l.meal_type] || l.meal_type} · {Math.round(l.calories)} kcal
              </span>
            </div>
            <button onClick={() => remove(l.id)} aria-label="Delete log" className="shrink-0 text-ink/25">
              <Trash2 size={16} />
            </button>
          </motion.div>
        ))}
      </div>

      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={scanPrefill ? "Confirm Scanned Food" : "Log Food"}
      >
        <AddFoodForm
          initial={scanPrefill}
          onDone={() => {
            setSheetOpen(false);
            setScanPrefill(null);
            load();
          }}
        />
      </Sheet>
    </Stagger>
  );
}
