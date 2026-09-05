export function Label({ children }) {
  return (
    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-ink/40">
      {children}
    </label>
  );
}

export function Input({ className = "w-full", ...props }) {
  return (
    <input
      {...props}
      className={`glass min-w-0 rounded-xl px-4 py-3 text-[14px] font-medium text-ink placeholder:text-ink/30 focus:outline-none ${className}`}
    />
  );
}

export function Select({ children, ...props }) {
  return (
    <select
      {...props}
      className="glass w-full rounded-xl px-4 py-3 text-[14px] font-medium text-ink focus:outline-none"
    >
      {children}
    </select>
  );
}

export function PrimaryButton({ children, className = "", ...props }) {
  return (
    <button
      {...props}
      className={`flex w-full items-center justify-center gap-2 rounded-2xl bg-ink px-4 py-3.5 text-[14px] font-bold text-white shadow-[0_8px_24px_rgba(16,20,31,0.25)] disabled:opacity-50${className ? ` ${className}` : ""}`}
    >
      {children}
    </button>
  );
}
