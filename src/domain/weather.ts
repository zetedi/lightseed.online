// The weather's face — pure mappings for the event-card weather chip. The fetch itself
// lives in services/weather (Open-Meteo); these rules stay testable without a network.

// WMO weather interpretation codes (Open-Meteo uses them) → a face and a word.
const WMO: { codes: number[]; emoji: string; label: string }[] = [
  { codes: [0], emoji: '☀️', label: 'Clear' },
  { codes: [1, 2], emoji: '🌤️', label: 'Mostly clear' },
  { codes: [3], emoji: '☁️', label: 'Overcast' },
  { codes: [45, 48], emoji: '🌫️', label: 'Fog' },
  { codes: [51, 53, 55, 56, 57], emoji: '🌦️', label: 'Drizzle' },
  { codes: [61, 63, 65, 66, 67], emoji: '🌧️', label: 'Rain' },
  { codes: [71, 73, 75, 77, 85, 86], emoji: '🌨️', label: 'Snow' },
  { codes: [80, 81, 82], emoji: '🌦️', label: 'Showers' },
  { codes: [95, 96, 99], emoji: '⛈️', label: 'Thunderstorm' },
];

export const weatherFace = (wmoCode: number): { emoji: string; label: string } => {
  const hit = WMO.find(w => w.codes.includes(wmoCode));
  return hit ? { emoji: hit.emoji, label: hit.label } : { emoji: '🌡️', label: 'Weather' };
};

// Does this event location name a PLACE under the sky (vs an online room)? Only places
// get a weather chip — the internet has no weather, only moods.
export const isPhysicalLocation = (location?: string | null): boolean => {
  const loc = (location || '').trim();
  if (!loc) return false;
  if (/https?:\/\/|www\./i.test(loc)) return false;
  if (/\b(online|zoom|google meet|meet\.|teams|webinar|discord|jitsi|skype|virtual)\b/i.test(loc)) return false;
  return true;
};

// Open-Meteo's daily forecast reaches 16 days out; beyond that (or in the past) the chip
// falls back to current weather at the place.
export const FORECAST_HORIZON_DAYS = 16;

export const isForecastable = (eventDateIso: string | undefined, nowMs: number): boolean => {
  if (!eventDateIso) return false;
  const t = Date.parse(eventDateIso);
  if (Number.isNaN(t)) return false;
  const days = (t - nowMs) / 86400000;
  return days >= 0 && days <= FORECAST_HORIZON_DAYS;
};
