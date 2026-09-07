/**
 * Soft ambient backdrop — a gentle tinted wash rather than the neon
 * glassmorphism blobs, matching a light/dark illustration-driven fitness
 * app aesthetic. Colors come from CSS vars so it flips with the theme.
 */
export default function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(to bottom right, var(--backdrop-a), var(--backdrop-b), var(--backdrop-c))",
        }}
      />
      <div className="animated-blob absolute -top-32 -left-24 h-[480px] w-[480px] rounded-full bg-[radial-gradient(circle,rgba(91,108,255,0.10),transparent_70%)] blur-3xl" />
      <div
        className="animated-blob absolute top-[28%] -right-32 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(255,122,0,0.10),transparent_70%)] blur-3xl"
        style={{ animationDelay: "-5s" }}
      />
      <div
        className="animated-blob absolute bottom-[-10%] left-[18%] h-[460px] w-[460px] rounded-full bg-[radial-gradient(circle,rgba(34,169,212,0.10),transparent_70%)] blur-3xl"
        style={{ animationDelay: "-10s" }}
      />
    </div>
  );
}
