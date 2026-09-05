import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  LogOut,
  Wallet,
  Target,
  Loader2,
  Plus,
  FileUp,
  FileText,
  CheckCircle2,
  Sun,
  Moon,
  Monitor,
  ShieldCheck,
  ScrollText,
} from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth.jsx";
import { useTheme } from "../lib/theme.jsx";
import { PRIVACY_POLICY, TERMS_AND_CONDITIONS } from "../lib/legalContent.js";
import { Stagger, fadeUp, SPRING_SNAPPY } from "../lib/motion.jsx";
import Sheet from "../components/Sheet.jsx";
import LegalSheet from "../components/LegalSheet.jsx";
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

function ImportPlanForm({ onDone }) {
  const [text, setText] = useState("");
  const [importing, setImporting] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const fileRef = useRef(null);
  const pdfRef = useRef(null);

  const onFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result || ""));
    reader.readAsText(file);
  };

  const onPdf = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setReading(true);
    try {
      const { extractPdfText } = await import("../lib/pdf.js");
      const extracted = await extractPdfText(file);
      if (!extracted) {
        setError("Couldn't find any text in that PDF — it may be a scanned image.");
        return;
      }
      setText(extracted);
    } catch (err) {
      setError(err.message || "Could not read that PDF.");
    } finally {
      setReading(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setImporting(true);
    setError(null);
    try {
      const { summary } = await api.ai.importPlan(text);
      setResult(summary);
    } catch (err) {
      setError(err.message || "Could not read that plan.");
    } finally {
      setImporting(false);
    }
  };

  if (result) {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <CheckCircle2 size={32} className="text-acc-lime" />
        <p className="text-[14px] font-semibold text-ink">Plan imported</p>
        <p className="text-[12px] text-ink/50">
          {result.targets_set && "Nutrition targets set. "}
          {result.goals_created > 0 && `${result.goals_created} goal(s) added. `}
          {result.workouts_created > 0 && `${result.workouts_created} workout(s) added.`}
          {!result.targets_set && !result.goals_created && !result.workouts_created && "Nothing new was found to add."}
        </p>
        <PrimaryButton onClick={onDone} className="mt-2">
          Done
        </PrimaryButton>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 pb-2">
      <p className="text-[12px] leading-relaxed text-ink/50">
        Paste a workout or nutrition plan, or upload a PDF or .txt file — AI will pull out targets,
        goals, and workouts and fill them in automatically.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => pdfRef.current?.click()}
          disabled={reading}
          className="glass-tint flex items-center justify-center gap-2 rounded-xl py-3 text-[13px] font-semibold text-ink disabled:opacity-60"
        >
          {reading ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
          Scan PDF
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="glass-tint flex items-center justify-center gap-2 rounded-xl py-3 text-[13px] font-semibold text-ink"
        >
          <FileUp size={16} />
          Upload .txt
        </button>
      </div>
      <input ref={fileRef} type="file" accept=".txt,text/plain" className="hidden" onChange={onFile} />
      <input ref={pdfRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={onPdf} />
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste your plan here..."
        rows={8}
        className="glass min-w-0 rounded-xl px-4 py-3 text-[13px] leading-relaxed text-ink placeholder:text-ink/30 focus:outline-none"
      />
      {error && <p className="rounded-xl bg-acc-pink/10 px-4 py-2.5 text-[12px] font-medium text-acc-pink">{error}</p>}
      <PrimaryButton type="submit" disabled={importing || !text.trim()}>
        {importing ? <Loader2 size={18} className="animate-spin" /> : "Import with AI"}
      </PrimaryButton>
    </form>
  );
}

const THEME_OPTIONS = [
  { id: "light", icon: Sun, label: "Light" },
  { id: "system", icon: Monitor, label: "Auto" },
  { id: "dark", icon: Moon, label: "Dark" },
];

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <motion.div variants={fadeUp} className="glass-tint flex rounded-2xl p-1">
      {THEME_OPTIONS.map((opt) => {
        const isActive = theme === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => setTheme(opt.id)}
            className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-[12px] font-semibold transition-colors ${
              isActive ? "text-white" : "text-ink/45"
            }`}
          >
            {isActive && (
              <motion.span
                layoutId="theme-pill"
                transition={SPRING_SNAPPY}
                className="absolute inset-0 rounded-xl bg-acc-orange"
              />
            )}
            <opt.icon size={14} className="relative" />
            <span className="relative">{opt.label}</span>
          </button>
        );
      })}
    </motion.div>
  );
}

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const [dashboard, setDashboard] = useState(null);
  const [sheet, setSheet] = useState(null); // "expense" | "targets" | "import" | "privacy" | "terms" | null

  const load = () => {
    api.dashboard().then(setDashboard);
  };
  useEffect(load, []);

  const budget = dashboard?.budget;

  return (
    <Stagger className="flex flex-col gap-5 px-8 pb-24 pt-2">
      <motion.div variants={fadeUp} className="flex flex-col items-center gap-3 pt-2 text-center">
        <div className="glass-tint flex h-20 w-20 items-center justify-center rounded-[28px] text-3xl font-bold text-ink">
          {user?.name?.[0]?.toUpperCase() || "?"}
        </div>
        <div>
          <h1 className="text-[19px] font-bold tracking-[-0.02em] text-ink">{user?.name}</h1>
          <p className="text-[12px] font-medium text-ink/40">{user?.email}</p>
        </div>
      </motion.div>

      <ThemeToggle />

      <motion.div variants={fadeUp} className="glass rounded-[28px] p-6">
        <div className="mb-3 flex items-center justify-between">
          <span className="flex items-center gap-2 text-[13px] font-semibold text-ink/70">
            <Wallet size={16} className="text-acc-lime" />
            This Month
          </span>
          <button onClick={() => setSheet("expense")} className="glass-tint flex h-8 w-8 items-center justify-center rounded-full text-ink">
            <Plus size={14} />
          </button>
        </div>
        {budget ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="glass-tint rounded-2xl px-4 py-3">
              <div className="text-[16px] font-bold text-acc-lime">₹{Math.round(budget.income ?? 0)}</div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink/40">Income</div>
            </div>
            <div className="glass-tint rounded-2xl px-4 py-3">
              <div className="text-[16px] font-bold text-acc-orange">₹{Math.round(budget.expenses ?? 0)}</div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink/40">Expenses</div>
            </div>
          </div>
        ) : (
          <Loader2 size={18} className="animate-spin text-ink/40" />
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
          <span className="block text-[14px] font-semibold text-ink">Nutrition Targets</span>
          <span className="text-[12px] font-medium text-ink/45">
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
        onClick={() => setSheet("import")}
        className="glass flex items-center gap-4 rounded-[24px] px-5 py-4 text-left"
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-acc-violet/12">
          <FileUp size={20} className="text-acc-violet" />
        </div>
        <div className="flex-1">
          <span className="block text-[14px] font-semibold text-ink">Import a Plan</span>
          <span className="text-[12px] font-medium text-ink/45">Let AI fill it in from a paste or file</span>
        </div>
      </motion.button>

      <motion.button
        variants={fadeUp}
        whileTap={{ scale: 0.98 }}
        transition={SPRING_SNAPPY}
        onClick={() => setSheet("privacy")}
        className="glass flex items-center gap-4 rounded-[24px] px-5 py-4 text-left"
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-ink/6">
          <ShieldCheck size={20} className="text-ink/60" />
        </div>
        <span className="flex-1 text-[14px] font-semibold text-ink">Privacy Policy</span>
      </motion.button>

      <motion.button
        variants={fadeUp}
        whileTap={{ scale: 0.98 }}
        transition={SPRING_SNAPPY}
        onClick={() => setSheet("terms")}
        className="glass flex items-center gap-4 rounded-[24px] px-5 py-4 text-left"
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-ink/6">
          <ScrollText size={20} className="text-ink/60" />
        </div>
        <span className="flex-1 text-[14px] font-semibold text-ink">Terms & Conditions</span>
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

      <motion.p variants={fadeUp} className="pb-2 pt-2 text-center text-[11px] font-medium text-ink/30">
        FitPocket is created and managed by Pocket Projects.
      </motion.p>

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
      <Sheet open={sheet === "import"} onClose={() => setSheet(null)} title="Import a Plan">
        <ImportPlanForm
          onDone={() => {
            setSheet(null);
            load();
          }}
        />
      </Sheet>
      <Sheet open={sheet === "privacy"} onClose={() => setSheet(null)} title="Privacy Policy">
        <LegalSheet text={PRIVACY_POLICY} />
      </Sheet>
      <Sheet open={sheet === "terms"} onClose={() => setSheet(null)} title="Terms & Conditions">
        <LegalSheet text={TERMS_AND_CONDITIONS} />
      </Sheet>
    </Stagger>
  );
}
