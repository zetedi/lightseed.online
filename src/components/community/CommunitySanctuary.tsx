import React from 'react';
import { Icons } from '../ui/Icons';
import { Community, Sanctuary } from '../../types';
import { SectionTitle } from '../ui/SectionTitle';
import { tabTone } from '../../utils/tabTheme';

interface CommunitySanctuaryProps {
  community: Community;
  // The first sanctuary rooted in this domain (earliest), shown as "The Sanctuary".
  sanctuary: Sanctuary | null;
}

// The Sanctuary tab — the first sacred place that holds this community's lifetrees.
export const CommunitySanctuary: React.FC<CommunitySanctuaryProps> = ({ community, sanctuary }) => (
  <div>
    <SectionTitle title="The Sanctuary" sub="The first sacred place that holds this community's lifetrees." />
    {!sanctuary ? (
      <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center text-slate-400">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-500"><Icons.Sun /></div>
        <p className="text-sm">No sanctuary has been consecrated for this community yet.</p>
      </div>
    ) : (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="relative h-64 md:h-80 w-full overflow-hidden rounded-2xl shadow-xl group">
          {sanctuary.imageUrl ? (
            <img src={sanctuary.imageUrl} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" alt={sanctuary.name} />
          ) : (
            <div className="h-full w-full" style={{ backgroundColor: community.theme?.primary || tabTone('communities') }} />
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
