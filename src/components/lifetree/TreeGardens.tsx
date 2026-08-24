import { useEffect, useMemo, useState } from 'react';
import type { Community, Lifetree } from '../../types';
import { fetchCommunities, standTreeInCommunity, withdrawTreeFromCommunity, communitiesTreeStandsIn } from '../../services/firebase';
import { doorOf } from '../../domain/communityDoor';
import { useLanguage } from '../../contexts/LanguageContext';
import { showAlert } from '../ui/Dialog';
import { Icons } from '../ui/Icons';

// THE GARDENS a tree stands in (grows_in, ring 2026-08-24). The tree's `domain` stays its
// one place-of-record; these edges only widen which forests SHOW it. The autocomplete
// speaks both vocabularies — a community's name and its domain — because "add
// lightseed.online to this tree" and "add The Node" are the same wish. The community's
// own door decides the gesture: open → the owner steps in; else the keeper welcomes.
export const TreeGardens = ({ tree, canManage }: { tree: Lifetree; canManage: boolean }) => {
  const { t } = useLanguage();
  const [all, setAll] = useState<Community[]>([]);
  const [standingIds, setStandingIds] = useState<string[]>([]);
  const [term, setTerm] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([fetchCommunities().catch(() => [] as Community[]), communitiesTreeStandsIn(tree.id).catch(() => [] as string[])])
      .then(([communities, ids]) => { if (alive) { setAll(communities); setStandingIds(ids); } });
    return () => { alive = false; };
  }, [tree.id]);

  const standing = useMemo(() => all.filter(c => standingIds.includes(c.id)), [all, standingIds]);
  const suggestions = useMemo(() => {
    const q = term.trim().toLowerCase();
    if (!q) return [];
    return all
      .filter(c => !standingIds.includes(c.id))
      .filter(c => (c.domain || '') !== (tree.domain || '__none__')) // its own home needs no edge
      .filter(c => `${c.name || ''} ${c.domain || ''}`.toLowerCase().includes(q))
      .slice(0, 6);
  }, [all, standingIds, term, tree.domain]);

  const stand = async (c: Community) => {
    setBusy(c.id);
    try {
      await standTreeInCommunity(tree.id, c.id);
      setStandingIds(prev => [...prev, c.id]);
      setTerm('');
    } catch {
      // The door was not open and this hand is not the keeper's — say it gently.
      showAlert(t('garden_door_closed'));
    }
    setBusy(null);
  };

  const withdraw = async (c: Community) => {
    setBusy(c.id);
    try {
      await withdrawTreeFromCommunity(tree.id, c.id);
      setStandingIds(prev => prev.filter(id => id !== c.id));
    } catch { /* leave the chip standing — the edge outlived the click */ }
    setBusy(null);
  };

  if (!canManage && standing.length === 0) return null;

  return (
    <div className="mt-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <h3 className="flex items-center text-xs font-bold uppercase tracking-wider text-slate-400">
        <Icons.Globe /><span className="ml-2">{t('tree_gardens')}</span>
      </h3>
      <p className="mt-1 text-[12px] text-slate-500">{t('tree_gardens_hint')}</p>
      {standing.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {standing.map(c => (
            <span key={c.id} className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">
              {c.name}
              <span className="font-mono text-[10px] font-normal text-emerald-600/80">{c.domain}</span>
              {canManage && (
                <button type="button" disabled={busy === c.id} onClick={() => withdraw(c)}
                  className="ml-0.5 rounded-full text-emerald-500 transition-colors hover:text-red-500" aria-label={`${t('remove')} ${c.name}`}>
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
      )}
      {canManage && (
        <div className="relative mt-3">
          <input dir="auto" value={term} onChange={e => setTerm(e.target.value)} placeholder={t('garden_search_ph')}
            className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          {suggestions.length > 0 && (
            <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
              {suggestions.map(c => (
                <button key={c.id} type="button" disabled={busy === c.id} onClick={() => stand(c)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-emerald-50 disabled:opacity-50">
                  <span className="min-w-0">
                    <span className="font-bold text-slate-700">{c.name}</span>
                    <span className="ml-2 font-mono text-[11px] text-slate-400">{c.domain}</span>
                  </span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${doorOf(c) === 'open' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {doorOf(c) === 'open' ? t('door_open') : t('door_keeper')}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
