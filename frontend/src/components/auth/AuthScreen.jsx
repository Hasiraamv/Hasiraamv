import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, User, Loader2, ArrowRight } from "lucide-react";
import { useAuth } from "../../lib/auth.jsx";
import { fadeUp, Stagger, SPRING_SNAPPY } from "../../lib/motion.jsx";

function Field({ icon: Icon, ...props }) {
  return (
    <div className="glass flex items-center gap-3 rounded-2xl px-4 py-3.5">
      <Icon size={18} className="shrink-0 text-white/40" />
      <input
        {...props}
        className="w-full bg-transparent text-[14px] font-medium text-white placeholder:text-white/35 focus:outline-none"
      />
    </div>
  );
}

export default function AuthScreen() {
  const { login, register, error, setError } = useAuth();
  const [mode, setMode] = useState("login"); // login | signup
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const ok =
      mode === "login"
        ? await login(form.email.trim(), form.password)
        : await register(form.name.trim(), form.email.trim(), form.password);
    setSubmitting(false);
    if (!ok) return;
  };

  return (
    <Stagger className="flex h-full flex-col justify-center gap-8 px-8 pb-10">
      <motion.div variants={fadeUp} className="flex flex-col items-center gap-3 text-center">
        <div className="glass-tint flex h-16 w-16 items-center justify-center rounded-[24px] text-3xl">
          💪
        </div>
        <h1 className="text-[26px] font-bold tracking-[-0.03em] text-white">
          Fit Pocket
        </h1>
        <p className="max-w-[240px] text-[13px] leading-relaxed text-white/45">
          Fitness, nutrition and budget — all in one pocket.
        </p>
      </motion.div>

      <motion.div variants={fadeUp} className="glass-tint flex rounded-2xl p-1">
        {["login", "signup"].map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            className={`relative flex-1 rounded-xl py-2.5 text-[13px] font-semibold transition-colors ${
              mode === m ? "text-white" : "text-white/40"
            }`}
          >
            {mode === m && (
              <motion.span
                layoutId="auth-pill"
                transition={SPRING_SNAPPY}
                className="absolute inset-0 rounded-xl bg-white/12"
              />
            )}
            <span className="relative">{m === "login" ? "Sign In" : "Sign Up"}</span>
          </button>
        ))}
      </motion.div>

      <motion.form variants={fadeUp} onSubmit={handleSubmit} className="flex flex-col gap-3">
        <AnimatePresence mode="popLayout" initial={false}>
          {mode === "signup" && (
            <motion.div
              key="name"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={SPRING_SNAPPY}
              className="overflow-hidden"
            >
              <Field
                icon={User}
                type="text"
                placeholder="Full name"
                value={form.name}
                onChange={update("name")}
                required
                autoComplete="name"
              />
            </motion.div>
          )}
        </AnimatePresence>

        <Field
          icon={Mail}
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={update("email")}
          required
          autoComplete="email"
        />
        <Field
          icon={Lock}
          type="password"
          placeholder="Password (min. 8 characters)"
          value={form.password}
          onChange={update("password")}
          required
          minLength={8}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
        />

        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-xl bg-acc-pink/12 px-4 py-2.5 text-[12px] font-medium text-acc-pink"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        <motion.button
          whileTap={{ scale: 0.97 }}
          transition={SPRING_SNAPPY}
          type="submit"
          disabled={submitting}
          className="mt-2 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-500 to-acc-violet px-4 py-3.5 text-[14px] font-bold text-white shadow-[0_8px_30px_rgba(91,108,255,0.35)] disabled:opacity-60"
        >
          {submitting ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <>
              {mode === "login" ? "Sign In" : "Create Account"}
              <ArrowRight size={16} />
            </>
          )}
        </motion.button>
      </motion.form>
    </Stagger>
  );
}
