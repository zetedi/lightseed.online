import React from 'react';
import { Icons } from '../ui/Icons';
import { Sanctuary } from '../../types';
import { SectionTitle } from '../ui/SectionTitle';

// Being-generic sanctuary section — the sacred place that holds any being's lifetrees
// (Indra's net). A community shows its domain's first sanctuary; a personal profile can
// present the same solo-value experience. The section stays pure-presentational: the owner
// loads the sanctuary in its shell (communities share it across tabs) and passes the value
// in — handing a loader to the section instead would flash the empty state on every mount.
// CommunitySanctuary is a thin wrapper over this.

interface SanctuarySectionProps {
  // Section heading (the owner names its own anatomy).
  title: string;
  sub?: string;
  // The sanctuary to present (loaded by the owner); null shows the not-yet-consecrated state.
  sanctuary: Sanctuary | null;
  emptyMessage?: string;
  // Background for the hero when the sanctuary has no image (the owner's theme accent).
  placeholderColor?: string;
}

// Sanctuary section — present the sacred place standing with any entity.
export const SanctuarySection: React.FC<SanctuarySectionProps> = ({
  title,
  sub,
  sanctuary,
  emptyMessage = 'No sanctuary has been consecrated yet.',
  placeholderColor,
}) => (
  <div>
    <SectionTitle title={title} sub={sub} />
    {!sanctuary ? (
      <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center text-slate-400">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-500"><Icons.Sun /></div>
        <p className="text-sm">{emptyMessage}</p>
      </div>
    ) : (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="relative h-64 md:h-80 w-full overflow-hidden rounded-2xl shadow-xl group">
          {sanctuary.imageUrl ? (
            <img src={sanctuary.imageUrl} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" alt={sanctuary.name} />
          ) : (
            <div className="h-full w-full" style={{ backgroundColor: placeholderColor }} />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          <div className="absolute bottom-5 left-5 right-5 text-white">
            <h2 className="break-words text-3xl font-light tracking-wide">{sanctuary.name}</h2>
            {sanctuary.shortTitle && <p className="mt-1 text-sm font-bold uppercase tracking-widest text-emerald-300">{sanctuary.shortTitle}</p>}
          </div>
        </div>

        {sanctuary.locationName && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-600"><Icons.Loc /> {sanctuary.locationName}</span>
          </div>
        )}

        {sanctuary.body && (
          <p className="whitespace-pre-line text-justify font-serif text-lg leading-relaxed text-slate-700">{sanctuary.body}</p>
        )}
      </div>
    )}
  </div>
);
