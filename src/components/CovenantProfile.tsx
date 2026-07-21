import { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Icons } from './ui/Icons';
import { ProfileHero } from './ui/ProfileHero';
import { CovenantPanel } from './CovenantPanel';
import type { Covenant } from '../domain/covenant';

// THE COVENANT PROFILE — the covenant standing alone: a hero (kind, title, live status chip)
// over the one shared face, CovenantPanel. All covenant logic (load, verify, sign, break, the
// key modal) lives in the panel, so this face and the alignment's covenant section can never
// tell two different stories about the same seal.

interface CovenantProfileProps {
  covenantId: string;
  currentUserId?: string;
  onClose: () => void;
  notify?: (m: string) => void;
}

export const CovenantProfile = ({ covenantId, currentUserId, onClose, notify }: CovenantProfileProps) => {
  const { t } = useLanguage();
  // Mirrored from the panel's load, purely for the hero chrome (title, kind, status chip).
  const [covenant, setCovenant] = useState<Covenant | null>(null);

  const status = covenant?.status === 'sealed'
    ? { label: t('covenant_status_sealed'), cls: 'bg-emerald-100 text-emerald-700' }
    : covenant?.status === 'broken'
      ? { label: t('covenant_status_broken'), cls: 'bg-rose-100 text-rose-600' }
      : { label: t('covenant_status_proposed'), cls: 'bg-amber-100 text-amber-700' };

  return (
    <div className="min-h-screen animate-in fade-in zoom-in-95 duration-300 pb-20 bg-slate-50">
      <ProfileHero>
        <div className="mb-6 flex items-center justify-between">
          <button onClick={onClose} className="flex items-center gap-2 text-sm font-medium text-white/70 hover:text-white">
            <Icons.ArrowLeft /><span>{t('back')}</span>
          </button>
          {covenant && <span className={`rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide ${status.cls}`}>{status.label}</span>}
        </div>
        <div className="flex items-center gap-4 sm:gap-5">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-4 border-white bg-emerald-50 text-emerald-500 shadow-xl md:h-20 md:w-20">
            <Icons.Venn />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-300">
              {covenant?.kind === 'alignment' ? t('covenant_kind_alignment') : t('covenant_kind_covenant')}
            </p>
            <h1 className="min-w-0 break-words text-2xl font-light tracking-wide">{covenant?.title || t('covenant')}</h1>
            <p className="mt-1 text-xs text-slate-300">{t('covenant_hero_sub')}</p>
          </div>
        </div>
      </ProfileHero>

      <div className="mx-auto mt-6 max-w-3xl px-4 sm:px-6">
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-lg sm:p-6">
          <CovenantPanel covenantId={covenantId} currentUserId={currentUserId} notify={notify} onLoaded={setCovenant} />
        </div>
      </div>
    </div>
  );
};
