import { moonPhase, type MoonPhase } from '../domain/moon';
import { isForecastable, weatherFace } from '../domain/weather';

// The weather reader — Open-Meteo, a free public platform: no key, no account, CORS-open.
// Geocodes the event's place name, then reads the forecast for the event's day (within the
// 16-day horizon) or current conditions otherwise. Cached per place+day; fails to silence
// (the chip simply doesn't appear).

export interface EventWeatherReading {
  place: string;
  tempC: number;
  emoji: string;
  label: string;
  kind: 'forecast' | 'now';
  moon: MoonPhase;
}

const cache = new Map<string, Promise<EventWeatherReading | null>>();

const geocode = async (location: string): Promise<{ latitude: number; longitude: number; name: string } | null> => {
  // Free-text locations ("The Olive Grove, Crete") rarely geocode whole — try the full
  // string, then each comma-segment from the end (the city usually lives there).
  const candidates = [location, ...location.split(',').map(s => s.trim()).filter(Boolean).reverse()];
  for (const c of candidates) {
    try {
      const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(c)}&count=1&language=en&format=json`);
      if (!res.ok) continue;
      const json = await res.json();
      const hit = json?.results?.[0];
      if (hit) return { latitude: hit.latitude, longitude: hit.longitude, name: hit.name };
    } catch { /* try the next candidate */ }
  }
  return null;
};

export const fetchEventWeather = (location: string, eventDateIso?: string): Promise<EventWeatherReading | null> => {
  const day = (eventDateIso || '').slice(0, 10);
  const key = `${location.toLowerCase()}|${day}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const promise = (async (): Promise<EventWeatherReading | null> => {
    const place = await geocode(location);
    if (!place) return null;

    const moon = moonPhase(eventDateIso ? new Date(eventDateIso) : new Date());
    const base = `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&timezone=auto`;

    if (isForecastable(eventDateIso, Date.now())) {
      const res = await fetch(`${base}&daily=weather_code,temperature_2m_max&start_date=${day}&end_date=${day}`);
      if (res.ok) {
        const json = await res.json();
        const code = json?.daily?.weather_code?.[0];
        const temp = json?.daily?.temperature_2m_max?.[0];
        if (typeof code === 'number' && typeof temp === 'number') {
          return { place: place.name, tempC: temp, ...weatherFace(code), kind: 'forecast', moon };
        }
      }
    }

    // Past events / beyond the horizon: the sky over the place right now.
    const res = await fetch(`${base}&current=temperature_2m,weather_code`);
    if (!res.ok) return null;
    const json = await res.json();
    const code = json?.current?.weather_code;
    const temp = json?.current?.temperature_2m;
    if (typeof code !== 'number' || typeof temp !== 'number') return null;
    return { place: place.name, tempC: temp, ...weatherFace(code), kind: 'now', moon };
  })().catch(() => null);

  cache.set(key, promise);
  return promise;
};
