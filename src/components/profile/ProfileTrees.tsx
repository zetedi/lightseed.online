import React from 'react';
import { DARK_IMAGE_FALLBACK } from '../../utils/sanitize';
import { useLanguage } from '../../contexts/LanguageContext';
import { Icons } from '../ui/Icons';
import { Lifetree } from '../../types';
import { SectionTitle } from '../ui/SectionTitle';
import { ValidationBadge } from '../ValidationBadge';
import { isWateringOverdue } from '../../domain/watering';
import { isExplicitlyValidatedTree, daysUntilLapse } from '../../utils/validation';

// The tending/validation state lives in the shell — the hero badge derives from the same
// `tendedIds`, so re-tending a tree here must re-light the badge up there immediately.
interface ProfileTreesProps {
  myTrees: Lifetree[];
  guardedOnly: Lifetree[];
  // Mahameru — shown to everyone, last: The Original Tree.
  originalTree?: Lifetree | null;
  defaultTreeId?: string;
  onSetDefaultTree?: (treeId: string) => void;
  onViewTree: (tree: Lifetree, section?: string) => void;
  onDeleteTree: (treeId: string) => void;
  onPlant: () => void;
  allValidated: boolean;
  treesNeedingCare: Lifetree[];
  lapsedValidated: (tree: Lifetree) => boolean;
  fadingValidated: (tree: Lifetree) => boolean;
  tendingId: string | null;
  onTend: (tree: Lifetree) => void;
}

// My Trees tab — planted trees (owned/stewarded) and trees guarded for others.
export const ProfileTrees: React.FC<ProfileTreesProps> = ({
  myTrees,
  guardedOnly,
  originalTree,
  defaultTreeId,
  onSetDefaultTree,
  onViewTree,
  onDeleteTree,
  onPlant,
  allValidated,
  treesNeedingCare,
  lapsedValidated,
  fadingValidated,
  tendingId,
  onTend,
}) => {
  const { t } = useLanguage();

  return (
    <div className="space-y-8">
      {/* Planted — trees you own and steward */}
      <div>
        <SectionTitle title={t('planted_trees')} sub={t('planted_trees_sub')} />
        {treesNeedingCare.length > 0 && (
          <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <span className="mt-0.5 text-amber-500"><Icons.Eye /></span>
            <p className="text-xs leading-relaxed text-amber-800">{t('care_nudge')}</p>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {allValidated && (
            <div onClick={onPlant} className="border-2 border-dashed border-slate-300 rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer hover:border-emerald-500 hover:bg-slate-50 min-h-[100px] text-slate-400 hover:text-emerald-600 transition-all group">
              <div className="bg-slate-100 p-3 rounded-full group-hover:bg-emerald-100 transition-colors">
                <Icons.Tree />
              </div>
              <span className="font-bold mt-2 text-sm">Plant New Tree</span>
            </div>
          )}

          {myTrees.length === 0 ? (
            !allValidated && <p className="text-slate-400 text-center py-10 col-span-full">No trees planted yet.</p>
          ) : (
            [...myTrees].sort((a: Lifetree, b: Lifetree) => (b.id === defaultTreeId ? 1 : 0) - (a.id === defaultTreeId ? 1 : 0)).map((tree: Lifetree) => (
              <div key={tree.id} onClick={() => onViewTree(tree)} className={`border rounded-lg p-4 hover:shadow-md cursor-pointer transition-all flex items-center justify-between group bg-white ${defaultTreeId === tree.id ? 'border-amber-300 ring-1 ring-amber-100' : 'border-emerald-100'}`}>
                <div className="flex items-center space-x-4">
                  <img src={tree.latestGrowthUrl || tree.imageUrl || DARK_IMAGE_FALLBACK} className="w-16 h-16 rounded object-cover bg-slate-100" />
                  <div>
                    <h3 className="font-bold text-slate-800 flex items-center gap-1.5">
                      {tree.name}
                      {defaultTreeId === tree.id && <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700"><Icons.Star filled size={10} /> Default</span>}
                    </h3>
                    <p className="text-xs text-slate-500">Block Height: {tree.blockHeight}</p>
                    {isExplicitlyValidatedTree(tree) ? (
                      <div className="mt-1 flex items-center gap-2">
                        <ValidationBadge compact lapsed={lapsedValidated(tree)} />
                        {isWateringOverdue(tree) && <button type="button" title="Needs water — open tree care" aria-label="Needs water — open tree care" onClick={(e) => { e.stopPropagation(); onViewTree(tree, 'care'); }} className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-500 text-white ring-2 ring-white/70 shadow-lg shadow-sky-900/30 transition-transform hover:scale-110 active:scale-95"><Icons.Droplet size={18} /></button>}
                        {(lapsedValidated(tree) || fadingValidated(tree)) && (
                          <button onClick={(e) => { e.stopPropagation(); onTend(tree); }} disabled={tendingId === tree.id} className="rounded-full bg-emerald-600 px-3 py-1 text-[10px] font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
                            {tendingId === tree.id ? '…' : t('tend')}
                          </button>
                        )}
                        {fadingValidated(tree) && !lapsedValidated(tree) && (
                          <span className="text-[10px] font-bold text-amber-600">{daysUntilLapse(tree)}d</span>
                        )}
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-2"><span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{t('pending')}</span>{isWateringOverdue(tree) && <button type="button" title="Needs water — open tree care" aria-label="Needs water — open tree care" onClick={(e) => { e.stopPropagation(); onViewTree(tree, 'care'); }} className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-500 text-white ring-2 ring-white/70 shadow-lg shadow-sky-900/30 transition-transform hover:scale-110 active:scale-95"><Icons.Droplet size={18} /></button>}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {onSetDefaultTree && (
                    <button
                      onClick={(e) => { e.stopPropagation(); if (defaultTreeId !== tree.id) onSetDefaultTree(tree.id); }}
                      disabled={defaultTreeId === tree.id}
                      className={`p-2 rounded-full transition-colors ${defaultTreeId === tree.id ? 'text-amber-500 cursor-default' : 'text-slate-300 hover:text-amber-500 hover:bg-amber-50 opacity-0 group-hover:opacity-100'}`}
                      title={defaultTreeId === tree.id ? 'Your default tree' : 'Set as my default tree'}
                    >
                      <Icons.Star filled={defaultTreeId === tree.id} />
                    </button>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); onDeleteTree(tree.id); }}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                    title={t('delete_tree_title')}
                  >
                    <Icons.Trash />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Guarded — trees you protect as a guardian (you don't own these) */}
      <div>
        <SectionTitle title={t('guarded_trees')} sub={t('guarded_trees_sub')} />
        {guardedOnly.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-slate-400">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-sky-50 text-sky-500"><Icons.Shield /></div>
            <p className="text-sm">You are not guarding any trees yet.</p>
            <p className="mt-1 text-xs">Open a Nature tree on the map and join its guardians to help protect it.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {guardedOnly.map((tree: Lifetree) => (
              <div key={tree.id} onClick={() => onViewTree(tree)} className="border border-sky-100 rounded-lg p-4 hover:shadow-md cursor-pointer transition-all flex items-center justify-between group bg-sky-50/40">
                <div className="flex items-center space-x-4">
                  <img src={tree.latestGrowthUrl || tree.imageUrl || DARK_IMAGE_FALLBACK} className="w-16 h-16 rounded object-cover bg-slate-100" />
                  <div>
                    <h3 className="font-bold text-slate-800 flex items-center gap-1.5">
                      {tree.name}
                      {isWateringOverdue(tree) && <button type="button" title="Needs water — open tree care" aria-label="Needs water — open tree care" onClick={(e) => { e.stopPropagation(); onViewTree(tree, 'care'); }} className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-500 text-white ring-2 ring-white/70 shadow-lg shadow-sky-900/30 transition-transform hover:scale-110 active:scale-95"><Icons.Droplet size={18} /></button>}
                    </h3>
                    <p className="text-xs text-slate-500">Block Height: {tree.blockHeight}</p>
                    <span className="mt-1 inline-flex items-center gap-1 text-[10px] bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full font-bold"><Icons.Shield /> Guardian</span>
                  </div>
                </div>
                {tree.status === 'DANGER' && (
                  <span className="bg-red-500 text-white px-2 py-0.5 rounded-full text-[9px] font-bold">DANGER</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* The Original Tree — Mahameru, for everyone, last. */}
      {originalTree && (
        <div>
          <SectionTitle
            title="The Original Tree"
            sub="Indestructible — it has dissolved into Nature, and became part of Phoenix, and of every tree planted since."
          />
          <div
            onClick={() => onViewTree(originalTree)}
            role="button"
            aria-label="Open Mahameru — The Original Tree"
            className="group flex cursor-pointer items-center gap-4 overflow-hidden rounded-2xl border border-amber-200/60 bg-[#04070f] p-4 shadow-lg transition-shadow hover:shadow-xl"
          >
            <img src={originalTree.latestGrowthUrl || originalTree.imageUrl || '/mahameru.svg'} alt="Mahameru"
                 className="h-16 w-16 shrink-0 rounded-full border-2 border-amber-300/70 object-cover transition-transform duration-700 group-hover:scale-105" />
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-lg font-light tracking-wide text-amber-100">{originalTree.name || 'Mahameru'}</h3>
              <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">The sea of creation — every chain remembers it.</p>
            </div>
            <Icons.ArrowRight size={18} className="shrink-0 text-amber-300/70" />
          </div>
        </div>
      )}
    </div>
  );
};
