/**
 * Apple Health-style workout calorie estimate — no heart rate sensor, so we
 * fall back to the same MET (metabolic equivalent) formula wearables use as
 * their own no-heart-rate estimate: calories = MET * weight_kg * hours.
 */

const DEFAULT_WEIGHT_KG = 70;
const AVERAGE_MINUTES_PER_SET = 1.5; // working time + rest, typical for lifting
const FALLBACK_MINUTES = 20; // no duration and no sets logged

type SetLike = {
  duration_seconds?: number | null;
  distance_km?: number | null;
  weight_kg?: number | null;
  reps?: number | null;
};

function metForSets(sets: SetLike[]): number {
  if (!sets.length) return 5; // general moderate activity
  const cardioSets = sets.filter((s) => (s.duration_seconds ?? 0) > 0 || (s.distance_km ?? 0) > 0);
  if (cardioSets.length >= sets.length / 2) return 8; // running/cycling/rowing-style cardio
  return 5; // general resistance training
}

function estimateMinutes(durationMinutes: number | null | undefined, sets: SetLike[]): number {
  if (durationMinutes && durationMinutes > 0) return durationMinutes;

  const cardioSeconds = sets.reduce((sum, s) => sum + (s.duration_seconds ?? 0), 0);
  if (cardioSeconds > 0) return cardioSeconds / 60;

  if (sets.length) return sets.length * AVERAGE_MINUTES_PER_SET;

  return FALLBACK_MINUTES;
}

export function estimateCaloriesBurned(
  durationMinutes: number | null | undefined,
  sets: SetLike[],
  weightKg: number | null | undefined
): number {
  const met = metForSets(sets);
  const minutes = estimateMinutes(durationMinutes, sets);
  const weight = weightKg && weightKg > 0 ? weightKg : DEFAULT_WEIGHT_KG;
  return Math.round(met * weight * (minutes / 60));
}
