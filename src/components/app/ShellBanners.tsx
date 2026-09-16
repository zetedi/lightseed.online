import React from 'react';
import type { Community, Lifetree } from '../../types';
import { Icons } from '../ui/Icons';
import { useLanguage } from '../../contexts/LanguageContext';

// THE SHELL'S BANNERS (ring 2026-09-16, lifted out of App.tsx unchanged): the amber
// "viewing as" strip while staff stand in community view, and the purple provenance banner
// while a superadmin carries a being's voice — the bridge stays visible the whole time:
// the being's words, the carrier's hands.
export const ShellBanners: React.FC<{
  impersonatedCommunity: Community | null;
  onExitCommunity: () => void;
  carryingTree: Lifetree | null;
  carrierName: string | null | undefined;
  onStopCarrying: () => void;
}> = ({ impersonatedCommunity, onExitCommunity, carryingTree, carrierName, onStopCarrying }) => {
  const { t } = useLanguage();
  return (
    <>
      {impersonatedCommunity && (
        <div className="sticky top-0 z-40 flex items-center justify-center gap-3 bg-amber-500 px-4 py-1.5 text-center text-xs font-bold text-white shadow-md">
          <span className="truncate">{t('viewing_as').replace('{name}', impersonatedCommunity.name)}</span>
          <button
            onClick={onExitCommunity}
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/25 px-2.5 py-0.5 font-bold uppercase tracking-wide hover:bg-white/40 dark:bg-slate-900/25"
          >
            <Icons.Close /> {t('exit_community')}
          </button>
        </div>
      )}
      {carryingTree && (
        /* Honest provenance banner — mirrors the community-view banner above. */
        <div className="sticky top-0 z-40 flex items-center justify-center gap-3 bg-purple-600 px-4 py-1.5 text-center text-xs font-bold text-white shadow-md">
          <span className="truncate">{t('carrying_line').replace('{tree}', carryingTree.name).replace('{name}', carrierName || t('you'))}</span>
          <button
            onClick={onStopCarrying}
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/25 px-2.5 py-0.5 font-bold uppercase tracking-wide hover:bg-white/40 dark:bg-slate-900/25"
          >
            <Icons.Close /> {t('stop_carrying')}
          </button>
        </div>
      )}
    </>
  );
};
