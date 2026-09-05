export function Label({ children }) {
  return (
    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-white/40">
      {children}
    </label>
  );
}

export function Input({ className = "w-full", ...props }) {
  return (
    <input
      {...props}
      className={`glass min-w-0 rounded-xl px-4 py-3 text-[14px] font-medium text-white placeholder:text-white/30 focus:outline-none ${className}`}
    />
  );
}

export function Select({ children, ...props }) {
  return (
    <select
      {...props}
      className="glass w-full rounded-xl px-4 py-3 text-[14px] font-medium text-white focus:outline-none [&>option]:bg-[#161b26]"
    >
      {children}
    </select>
  );
}

export function PrimaryButton({ children, className = "", ...props }) {
  return (
    <button
      {...props}
      className={`flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-500 to-acc-violet px-4 py-3.5 text-[14px] font-bold text-white shadow-[0_8px_30px_rgba(91,108,255,0.35)] disabled:opacity-50${className ? ` ${className}` : ""}`}
    >
      {children}
    </button>
  );
}
