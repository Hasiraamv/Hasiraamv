/**
 * FitPocket wordmark icon — rounded orange square with an abstract
 * lunging-runner glyph, per the brand kit (orange #FF7A00 / dark #2B1A0F).
 */
export default function Logo({ size = 40, rounded = "28%" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" rx={rounded} fill="#FF7A00" />
      <circle cx="63" cy="27" r="10" fill="#2B1A0F" />
      <path
        d="M28 78 C34 62 42 54 52 50 C60 47 58 38 50 36 C44 34.5 40 38 38 43"
        stroke="#2B1A0F"
        strokeWidth="10"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M52 50 C60 55 66 58 76 60"
        stroke="#2B1A0F"
        strokeWidth="10"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
