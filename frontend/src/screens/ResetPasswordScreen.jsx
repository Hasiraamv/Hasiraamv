import { useState } from "react";
import { motion } from "framer-motion";
import { Lock, Loader2, CheckCircle2 } from "lucide-react";
import { api } from "../lib/api";
import { Stagger, fadeUp, SPRING_SNAPPY } from "../lib/motion.jsx";
import Logo from "../components/Logo.jsx";

export default function ResetPasswordScreen({ token }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.auth.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(err.message || "This reset link is invalid or has expired.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Stagger className="flex min-h-[75vh] flex-col justify-center gap-8 px-8 pb-10">
      <motion.div variants={fadeUp} className="flex flex-col items-center gap-3 text-center">
        <Logo size={64} />
        <h1 className="text-[22px] font-bold tracking-[-0.03em] text-ink">Reset your password</h1>
      </motion.div>

      {done ? (
        <motion.div
          variants={fadeUp}
          className="glass-tint flex flex-col items-center gap-3 rounded-2xl px-5 py-8 text-center"
        >
          <CheckCircle2 size={32} className="text-acc-orange" />
          <p className="text-[14px] font-semibold text-ink">Password updated</p>
          <p className="text-[12px] text-ink/50">You can now sign in with your new password.</p>
          <a
            href="/"
            className="mt-2 rounded-2xl bg-acc-orange px-5 py-2.5 text-[13px] font-bold text-white shadow-[0_8px_24px_rgba(255,122,0,0.3)]"
          >
            Go to sign in
          </a>
        </motion.div>
      ) : (
        <motion.form variants={fadeUp} onSubmit={submit} className="flex flex-col gap-3">
          <div className="glass flex items-center gap-3 rounded-2xl px-4 py-3.5">
            <Lock size={18} className="shrink-0 text-ink/35" />
            <input
              type="password"
              placeholder="New password (min. 8 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
              autoComplete="new-password"
              className="w-full bg-transparent text-[14px] font-medium text-ink placeholder:text-ink/30 focus:outline-none"
            />
          </div>
          <div className="glass flex items-center gap-3 rounded-2xl px-4 py-3.5">
            <Lock size={18} className="shrink-0 text-ink/35" />
            <input
              type="password"
              placeholder="Confirm new password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              minLength={8}
              required
              autoComplete="new-password"
              className="w-full bg-transparent text-[14px] font-medium text-ink placeholder:text-ink/30 focus:outline-none"
            />
          </div>

          {error && (
            <p className="rounded-xl bg-acc-pink/10 px-4 py-2.5 text-[12px] font-medium text-acc-pink">{error}</p>
          )}

          <motion.button
            whileTap={{ scale: 0.97 }}
            transition={SPRING_SNAPPY}
            type="submit"
            disabled={submitting}
            className="mt-2 flex items-center justify-center gap-2 rounded-2xl bg-acc-orange px-4 py-3.5 text-[14px] font-bold text-white shadow-[0_8px_24px_rgba(255,122,0,0.3)] disabled:opacity-60"
          >
            {submitting ? <Loader2 size={18} className="animate-spin" /> : "Update password"}
          </motion.button>
        </motion.form>
      )}
    </Stagger>
  );
}
