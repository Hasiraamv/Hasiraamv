import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { LogOut, Wallet, Target, Loader2, Plus } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth.jsx";
import { Stagger, fadeUp, SPRING_SNAPPY } from "../lib/motion.jsx";
import Sheet from "../components/Sheet.jsx";
import { Label, Input, Select, PrimaryButton } from "../components/FormField.jsx";

function AddExpenseForm({ onDone }) {
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState("expense");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.budget.categories().then((d) => {
      setCategories(d.categories);
      if (d.categories[0]) setCategoryId(d.categories[0].id);
    });
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.budget.addTransaction({
        category_id: categoryId,
        amount: Number(amount),
        type,
        date: new Date().toISOString().slice(0, 10),
      });
      onDone();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 pb-2">
      <div>
        <Label>Type</Label>
        <Select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="expense">Expense</option>
          <option value="income">Income</option>
        </Select>
      </div>
      <div>
        <Label>Category</Label>
        <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          {categories
            .filter((c) => c.kind === type)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </Select>
      </div>
      <div>
        <Label>Amount (₹)</Label>
        <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required />
      </div>
      <PrimaryButton type="submit" disabled={saving} className="mt-2">
        {saving ? <Loader2 size={18} className="animate-spin" /> : "Save"}
      </PrimaryButton>
    </form>
  );
}

function TargetsForm({ current, onDone }) {
  const [calories, setCalories] = useState(current?.daily_calories ?? "");
  const [protein, setProtein] = useState(current?.daily_protein ?? "");
  const [carbs, setCarbs] = useState(current?.daily_carbs ?? "");
  const [fat, setFat] = useState(current?.daily_fat ?? "");
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.nutrition.setTargets({
        daily_calories: calories ? Number(calories) : undefined,
        daily_protein: protein ? Number(protein) : undefined,
        daily_carbs: carbs ? Number(carbs) : undefined,
        daily_fat: fat ? Number(fat) : undefined,
      });
      onDone();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 pb-2">
      <div>
        <Label>Daily calories</Label>
        <Input inputMode="numeric" value={calories} onChange={(e) => setCalories(e.target.value)} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label>Protein (g)</Label>
          <Input inputMode="numeric" value={protein} onChange={(e) => setProtein(e.target.value)} />
        </div>
        <div>
          <Label>Carbs (g)</Label>
          <Input inputMode="numeric" value={carbs} onChange={(e) => setCarbs(e.target.value)} />
        </div>
        <div>
          <Label>Fat (g)</Label>
          <Input inputMode="numeric" value={fat} onChange={(e) => setFat(e.target.value)} />
        </div>
      </div>
      <PrimaryButton type="submit" disabled={saving} className="mt-2">
        {saving ? <Loader2 size={18} className="animate-spin" /> : "Save Targets"}
      </PrimaryButton>
    </form>
  );
}

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const [dashboard, setDashboard] = useState(null);
  const [sheet, setSheet] = useState(null); // "expense" | "targets" | null

  const load = () => {
    api.dashboard().then(setDashboard);
  };
  useEffect(load, []);

  const budget = dashboard?.budget;

  return (
    <Stagger className="flex flex-col gap-5 px-8 pb-24 pt-2">
      <motion.div variants={fadeUp} className="flex flex-col items-center gap-3 pt-2 text-center">
        <div className="glass-tint flex h-20 w-20 items-center justify-center rounded-[28px] text-3xl font-bold text-white">
          {user?.name?.[0]?.toUpperCase() || "?"}
        </div>
        <div>
          <h1 className="text-[19px] font-bold tracking-[-0.02em] text-white">{user?.name}</h1>
          <p className="text-[12px] font-medium text-white/40">{user?.email}</p>
        </div>
      </motion.div>

      <motion.div variants={fadeUp} className="glass rounded-[28px] p-6">
        <div className="mb-3 flex items-center justify-between">
          <span className="flex items-center gap-2 text-[13px] font-semibold text-white/70">
            <Wallet size={16} className="text-acc-lime" />
            This Month
          </span>
          <button onClick={() => setSheet("expense")} className="glass-tint flex h-8 w-8 items-center justify-center rounded-full text-white">
            <Plus size={14} />
          </button>
        </div>
        {budget ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="glass-tint rounded-2xl px-4 py-3">
              <div className="text-[16px] font-bold text-acc-lime">₹{Math.round(budget.income ?? 0)}</div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-white/40">Income</div>
            </div>
            <div className="glass-tint rounded-2xl px-4 py-3">
              <div className="text-[16px] font-bold text-acc-orange">₹{Math.round(budget.expenses ?? 0)}</div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-white/40">Expenses</div>
            </div>
          </div>
        ) : (
          <Loader2 size={18} className="animate-spin text-white/40" />
        )}
      </motion.div>

      <motion.button
        variants={fadeUp}
        whileTap={{ scale: 0.98 }}
        transition={SPRING_SNAPPY}
        onClick={() => setSheet("targets")}
        className="glass flex items-center gap-4 rounded-[24px] px-5 py-4 text-left"
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-acc-cyan/12">
          <Target size={20} className="text-acc-cyan" />
        </div>
        <div className="flex-1">
          <span className="block text-[14px] font-semibold text-white">Nutrition Targets</span>
          <span className="text-[12px] font-medium text-white/45">
            {dashboard?.nutrition?.targets?.daily_calories
              ? `${dashboard.nutrition.targets.daily_calories} kcal / day`
              : "Not set"}
          </span>
        </div>
      </motion.button>

      <motion.button
        variants={fadeUp}
        whileTap={{ scale: 0.98 }}
        transition={SPRING_SNAPPY}
        onClick={logout}
        className="glass flex items-center gap-4 rounded-[24px] px-5 py-4 text-left text-acc-pink"
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-acc-pink/12">
          <LogOut size={20} />
        </div>
        <span className="text-[14px] font-semibold">Sign Out</span>
      </motion.button>

      <Sheet open={sheet === "expense"} onClose={() => setSheet(null)} title="Add Transaction">
        <AddExpenseForm
          onDone={() => {
            setSheet(null);
            load();
          }}
        />
      </Sheet>
      <Sheet open={sheet === "targets"} onClose={() => setSheet(null)} title="Nutrition Targets">
        <TargetsForm
          current={dashboard?.nutrition?.targets}
          onDone={() => {
            setSheet(null);
            load();
          }}
        />
      </Sheet>
    </Stagger>
  );
}
