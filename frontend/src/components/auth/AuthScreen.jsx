import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, User, Loader2, ArrowRight } from "lucide-react";
import { useAuth } from "../../lib/auth.jsx";
import { fadeUp, Stagger, SPRING_SNAPPY } from "../../lib/motion.jsx";
import Logo from "../Logo.jsx";

function Field({ icon: Icon, ...props }) {
  return (
    <div className="glass flex items-center gap-3 rounded-2xl px-4 py-3.5">
      <Icon size={18} className="shrink-0 text-ink/35" />
      <input
        {...props}
        className="w-full bg-transparent text-[14px] font-medium text-ink placeholder:text-ink/30 focus:outline-none"
      />
    </div>
  );
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

function GoogleSignInButton() {
  const ref = useRef(null);
  const { loginWithGoogle } = useAuth();

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    let cancelled = false;

    const render = () => {
      if (cancelled || !ref.current || !window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (resp) => loginWithGoogle(resp.credential),
      });
      window.google.accounts.id.renderButton(ref.current, {
        theme: "outline",
        size: "large",
        shape: "pill",
        width: 320,
        text: "continue_with",
      });
    };

    if (window.google?.accounts?.id) {
      render();
      return;
    }
    const interval = setInterval(() => {
      if (window.google?.accounts?.id) {
        clearInterval(interval);
        render();
      }
    }, 150);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [loginWithGoogle]);

  if (!GOOGLE_CLIENT_ID) return null;

  return <div ref={ref} className="flex justify-center" />;
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
    <Stagger className="flex min-h-[75vh] flex-col justify-center gap-8 px-8 pb-10">
      <motion.div variants={fadeUp} className="flex flex-col items-center gap-3 text-center">
        <Logo size={64} />
        <h1 className="text-[26px] font-bold tracking-[-0.03em] text-ink">
          FitPocket
        </h1>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-acc-orange">
          Small steps. Bigger you.
        </p>
      </motion.div>

      {GOOGLE_CLIENT_ID && (
        <motion.div variants={fadeUp} className="flex flex-col gap-4">
          <GoogleSignInButton />
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-ink/8" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink/30">or</span>
            <div className="h-px flex-1 bg-ink/8" />
          </div>
        </motion.div>
      )}

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
              mode === m ? "text-white" : "text-ink/40"
            }`}
          >
            {mode === m && (
              <motion.span
                layoutId="auth-pill"
                transition={SPRING_SNAPPY}
                className="absolute inset-0 rounded-xl bg-acc-orange"
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
              className="rounded-xl bg-acc-pink/10 px-4 py-2.5 text-[12px] font-medium text-acc-pink"
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
          className="mt-2 flex items-center justify-center gap-2 rounded-2xl bg-acc-orange px-4 py-3.5 text-[14px] font-bold text-white shadow-[0_8px_24px_rgba(255,122,0,0.3)] disabled:opacity-60"
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
