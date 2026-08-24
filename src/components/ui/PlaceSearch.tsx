import { useRef, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { Icons } from './Icons';

// PLACE SEARCH (ring 2026-08-25) — type a place name, get coordinates. Geocoding is the one
// thing the app cannot do in-house, so it asks OpenStreetMap's Nominatim — a USER-INITIATED
// call (they type and press search), sending only the typed query, attributed below. Picking
// a result sets the coordinates and the place name; the map picker beside it stays the truth.
interface NominatimHit { lat: string; lon: string; display_name: string }

export const PlaceSearch = ({ onPick }: { onPick: (r: { latitude: number; longitude: number; name: string }) => void }) => {
  const { t } = useLanguage();
  const [term, setTerm] = useState('');
  const [hits, setHits] = useState<NominatimHit[]>([]);
  const [busy, setBusy] = useState(false);
  const reqId = useRef(0);

  const search = async () => {
    const q = term.trim();
    if (!q) return;
    setBusy(true);
    const mine = ++reqId.current;
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=6&q=${encodeURIComponent(q)}`;
      const res = await fetch(url, { headers: { 'Accept-Language': navigator.language || 'en' } });
      const data: NominatimHit[] = res.ok ? await res.json() : [];
      if (mine === reqId.current) setHits(data);
    } catch { if (mine === reqId.current) setHits([]); }
    if (mine === reqId.current) setBusy(false);
  };

  return (
    <div className="relative">
      <div className="flex gap-2">
        <input
          value={term}
          onChange={e => setTerm(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void search(); } }}
          placeholder={t('place_search_ph')}
          className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400"
        />
        <button type="button" onClick={() => void search()} disabled={busy || !term.trim()}
          className="flex shrink-0 items-center gap-1 rounded-xl bg-emerald-100 px-3 text-sm font-bold text-emerald-700 transition-colors hover:bg-emerald-200 disabled:opacity-50">
          {busy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" /> : <Icons.Loc />}
        </button>
      </div>
      {hits.length > 0 && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          {hits.map((h, i) => (
            <button key={i} type="button"
              onClick={() => { onPick({ latitude: Number(h.lat), longitude: Number(h.lon), name: h.display_name.split(',')[0] }); setHits([]); setTerm(h.display_name.split(',')[0]); }}
              className="block w-full truncate px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-emerald-50">
              {h.display_name}
            </button>
          ))}
          <p className="px-3 py-1 text-[9px] text-slate-400">{t('place_search_credit')}</p>
        </div>
      )}
    </div>
  );
};
