// The moon's state — pure astronomy, no API needed: the synodic month is a clock that has
// never missed a beat. Phase is derived from a known new moon (2000-01-06 18:14 UTC).

export interface MoonPhase {
  name: string;
  emoji: string;
  // 0 = new, 0.5 = full, →1 = new again.
  fraction: number;
}

const KNOWN_NEW_MOON_MS = 947182440000; // 2000-01-06 18:14 UTC
export const SYNODIC_MONTH_DAYS = 29.53058867;

const PHASES: { name: string; emoji: string }[] = [
  { name: 'New Moon', emoji: '🌑' },
  { name: 'Waxing Crescent', emoji: '🌒' },
  { name: 'First Quarter', emoji: '🌓' },
  { name: 'Waxing Gibbous', emoji: '🌔' },
  { name: 'Full Moon', emoji: '🌕' },
  { name: 'Waning Gibbous', emoji: '🌖' },
  { name: 'Last Quarter', emoji: '🌗' },
  { name: 'Waning Crescent', emoji: '🌘' },
];

export const moonPhase = (date: Date): MoonPhase => {
  const days = (date.getTime() - KNOWN_NEW_MOON_MS) / 86400000;
  const fraction = ((days % SYNODIC_MONTH_DAYS) + SYNODIC_MONTH_DAYS) % SYNODIC_MONTH_DAYS / SYNODIC_MONTH_DAYS;
  const index = Math.round(fraction * 8) % 8;
  return { ...PHASES[index], fraction };
};
