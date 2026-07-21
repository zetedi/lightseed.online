import React, { useState, useEffect } from 'react';
import { showAlert } from '../ui/Dialog';
import { useLanguage } from '../../contexts/LanguageContext';
import { Icons } from '../ui/Icons';
import { Alignment, Lifetree, VisionSynergy } from '../../types';
import { getMyAlignmentsHistory, getLifetreeById } from '../../services/firebase';
import { SectionTitle } from '../ui/SectionTitle';
import { Loading } from '../ui/Loading';
import { ResonanceCard, resonanceId } from '../ResonancePanel';

interface ProfileHistoryProps {
  uid: string;
  onViewAlignment?: (alignment: Alignment) => void;
  onReachTree?: (tree: Lifetree) => void;
}

// Alignments tab — saved Observatory resonances plus the user's alignment history.
export const ProfileHistory: React.FC<ProfileHistoryProps> = ({ uid, onViewAlignment, onReachTree }) => {
  const { t } = useLanguage();
  const [history, setHistory] = useState<Alignment[]>([]);
  // Starts true: the component mounts fresh on every tab activation and fetches immediately.
  const [loading, setLoading] = useState(true);
  // Resonances the user starred in the Observatory (kept in localStorage). Lazy-initialized
  // so opening the tab reads the store once, without a setState-in-effect cascade.
  const [savedResonances, setSavedResonances] = useState<VisionSynergy[]>(() => {
    try {
      const f = JSON.parse(localStorage.getItem('resonance_favorites_v1') || 'null');
      if (Array.isArray(f)) return f;
    } catch { /* corrupted store — fall through to empty */ }
    return [];
  });

  const unsaveResonance = (s: VisionSynergy) => {
    setSavedResonances(prev => {
      const next = prev.filter(f => resonanceId(f) !== resonanceId(s));
      try { localStorage.setItem('resonance_favorites_v1', JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const reachResonantTree = async (treeId: string) => {
    try { const tree = await getLifetreeById(treeId); if (tree && onReachTree) onReachTree(tree); }
    catch { showAlert('Could not open a conversation with that tree.'); }
  };

  // The two trees each alignment binds — fetched once per distinct tree so the cards can show
  // faces and names instead of a bare status row. Best-effort: an unreadable tree stays null
  // and its card falls back to a quiet placeholder.
  const [treesById, setTreesById] = useState<Record<string, Lifetree | null>>({});

  useEffect(() => {
    let alive = true;
    getMyAlignmentsHistory(uid)
      .then(async (data) => {
        if (!alive) return;
        setHistory(data);
        const ids = Array.from(new Set(data.flatMap(a => [a.initiatorTreeId, a.targetTreeId]).filter(Boolean)));
        const pairs = await Promise.all(ids.map(async id =>
          [id, await getLifetreeById(id).catch(() => null)] as [string, Lifetree | null],
        ));
        if (alive) setTreesById(Object.fromEntries(pairs));
      })
      .catch((e) => console.error('Fetch profile data error', e))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [uid]);

  return (
    <div>
      <SectionTitle title={t('alignments')} sub={t('alignments_sub')} />

      {savedResonances.length > 0 && (
        <div className="mb-8">
          <h4 className="mb-3 flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider text-slate-500"><span className="text-amber-500">★</span> {t('saved_resonances')}</h4>
          <div className="grid gap-3 sm:grid-cols-2">
            {savedResonances.map((s, i) => (
              <ResonanceCard key={i} s={s} isFavorite onToggleFavorite={() => unsaveResonance(s)} onReach={reachResonantTree} />
            ))}
          </div>
        </div>
      )}

      {loading ? <div className="flex justify-center rounded-2xl border border-slate-100 bg-slate-50/50 py-16"><Loading /></div> : (
        <div className="space-y-3">
          {history.length === 0 ? <p className="text-slate-400 text-center py-10">{t('no_history')}</p> : history.map((h) => {
            const a = treesById[h.initiatorTreeId];
            const b = treesById[h.targetTreeId];
            const status = h.status === 'ACCEPTED'
              ? { label: 'Finalised', cls: 'bg-emerald-100 text-emerald-700' }
              : h.status === 'REJECTED'
                ? { label: 'Declined', cls: 'bg-slate-100 text-slate-500' }
                : { label: 'Open', cls: 'bg-amber-100 text-amber-700' };
            const notes = h.messages?.length || 0;
            const face = (tree: Lifetree | null, ring: string, z: string) => {
              const img = tree?.latestGrowthUrl || tree?.imageUrl;
              return img
                ? <img src={img} alt="" referrerPolicy="no-referrer" className={`h-11 w-11 rounded-full object-cover ring-2 ${ring} ring-offset-1 ring-offset-white ${z}`} />
                : <span className={`flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-slate-200 to-slate-300 font-serif text-lg text-white ring-2 ${ring} ring-offset-1 ring-offset-white ${z}`}>{(tree?.name || '·').charAt(0).toUpperCase()}</span>;
            };
            return (
              <button key={h.id} onClick={() => onViewAlignment?.(h)} className="flex w-full items-center gap-3.5 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors hover:bg-slate-50">
                {/* The two trees the alignment binds, faces overlapping like the bond itself. */}
                <span className="flex shrink-0 -space-x-3">
                  {face(a, 'ring-sky-300', 'relative z-10')}
                  {face(b, 'ring-emerald-300', 'relative')}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-serif text-sm font-semibold text-slate-800">
                    {a?.name || 'A tree'} ↔ {b?.name || 'a tree'}
                  </span>
                  <span className="block text-xs text-slate-500">
                    {h.createdAt ? new Date(h.createdAt.toMillis()).toLocaleDateString() : ''}
                    {notes > 0 && ` · ${notes} note${notes === 1 ? '' : 's'} in the discussion`}
                  </span>
                </span>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${status.cls}`}>{status.label}</span>
                <Icons.ChevronRight className="shrink-0 text-slate-400" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
