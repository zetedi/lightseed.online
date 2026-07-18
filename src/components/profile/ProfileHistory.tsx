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

  useEffect(() => {
    let alive = true;
    getMyAlignmentsHistory(uid)
      .then((data) => { if (alive) setHistory(data); })
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
        <div className="space-y-4">
          {history.length === 0 ? <p className="text-slate-400 text-center py-10">{t('no_history')}</p> : history.map((h) => (
            <button key={h.id} onClick={() => onViewAlignment?.(h)} className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-4 text-left transition-colors hover:bg-slate-100">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-600"><Icons.Venn /></span>
                <div>
                  <p className="font-bold text-sm text-slate-700">{h.status === 'ACCEPTED' ? 'Finalised' : 'Open (in discussion)'}</p>
                  <p className="text-xs text-slate-500">{h.createdAt ? new Date(h.createdAt.toMillis()).toLocaleDateString() : ''}</p>
                </div>
              </div>
              <Icons.ChevronRight className="text-slate-400" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
