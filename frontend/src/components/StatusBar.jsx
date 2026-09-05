import { Wifi, BatteryFull } from "lucide-react";

/**
 * iOS-style status bar — time left, system icons right. Dark icons/text
 * since the screen background is now light.
 */
export default function StatusBar() {
  const now = new Date();
  const time = now.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).toLowerCase().replace(" ", "");

  return (
    <div className="relative z-40 flex items-center justify-between px-8 pt-4 pb-2 text-ink">
      <span className="text-[15px] font-semibold tracking-[-0.01em]">{time}</span>

      <div className="flex items-center gap-1.5">
        <div className="flex items-end gap-[2px]">
          {[5, 8, 11].map((h) => (
            <span key={h} className="w-[3px] rounded-[1px] bg-ink" style={{ height: h }} />
          ))}
        </div>
        <Wifi size={16} strokeWidth={2.6} className="text-ink" />
        <BatteryFull size={24} strokeWidth={1.6} className="text-ink" />
      </div>
    </div>
  );
}
