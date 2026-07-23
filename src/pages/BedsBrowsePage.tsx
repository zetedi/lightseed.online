import { useEffect, useState, type ReactNode } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useSession } from '../contexts/SessionContext';
import { Icons } from '../components/ui/Icons';
import { SectionHeader } from '../components/ui/SectionHeader';
import { ListBox } from '../components/ui/ListBox';
import { Loading } from '../components/ui/Loading';
import { ViewDensityToggle } from '../components/ui/ViewDensityToggle';
import { useListDensity, densityGridClass, type ListDensity } from '../hooks/useListDensity';
import { useVisibleLightHouses } from '../hooks/useVisibleLightHouses';
import { useRefreshSignal } from '../hooks/useRefreshSignal';
import { getBedsForLightHouse } from '../services/firebase/trees';
import { tabTone, type TabTheme } from '../utils/tabTheme';
import type { LightHouse } from '../domain/lightHouse';
import type { Lifetree } from '../types';

// The "browse beds" surface — every bed the viewer may see, stacked UNDER its Light House the
// way Light Houses stack under communities. A bed is a Lifetree (treeType 'BED', domain/bed.ts):
// tapping one opens it in BedProfile via onViewTree. Housed beds only: getBedsForLightHouse walks
// each visible Light House; LOOSE beds (no lightHouseId) have no fetcher yet, so they stay out of
// this list until one exists. Default bed visibility is 'node' — this is a signed-in surface.

interface BedGroup {
  house: LightHouse;
  beds: Lifetree[];
}

// One bed as a density card — the same shape as the Light House profile's beds tab: the bed's
// latest growth (or a Moon-lit gradient tile), its name, a truncated welcome, and a chevron.
const BedCard = ({ bed, onViewTree, density }: { bed: Lifetree; onViewTree: (t: Lifetree) => void; density: ListDensity }) => {
  const img = bed.latestGrowthUrl || bed.imageUrl || '';
  const moonTile = (size: string) => (
    <span className={`flex ${size} flex-none items-center justify-center rounded-xl bg-gradient-to-br from-indigo-400 to-violet-500 text-white [&>svg]:h-6 [&>svg]:w-6`}>
      <Icons.Moon />
    </span>
  );

  if (density === 'rows') {
    return (
      <button type="button" onClick={() => onViewTree(bed)}
        className="group flex w-full items-center gap-3 rounded-xl border border-slate-100 bg-white p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
        {img
          ? <img src={img} alt={bed.name} className="h-11 w-11 flex-none rounded-lg object-cover" />
          : moonTile('h-11 w-11')}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-slate-800">{bed.name}</p>
          <p className="truncate text-[11px] text-slate-400">{bed.body ? bed.body.slice(0, 80) : 'A place to sleep'}</p>
        </div>
        <span className="flex-none text-slate-300 [&>svg]:h-4 [&>svg]:w-4 group-hover:text-slate-500"><Icons.ChevronRight /></span>
      </button>
    );
  }

  if (density === 'mini') {
    return (
      <button type="button" onClick={() => onViewTree(bed)}
        className="group flex min-h-[8.5rem] w-full cursor-pointer flex-col overflow-hidden rounded-xl border border-slate-100 bg-white text-left shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl">
        <div className="relative h-20 w-full flex-none">
          {img
            ? <img src={img} alt={bed.name} className="absolute inset-0 h-full w-full object-cover" />
            : <span className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-indigo-400 to-violet-500 text-white [&>svg]:h-7 [&>svg]:w-7"><Icons.Moon /></span>}
        </div>
        <div className="min-w-0 flex-1 p-2.5">
          <p className="truncate text-sm font-bold text-slate-800">{bed.name}</p>
          <p className="mt-0.5 truncate text-[10px] text-slate-400">{bed.body ? bed.body.slice(0, 40) : 'A place to sleep'}</p>
        </div>
      </button>
    );
  }

  // CARDS — the full bed card (mirrors LightHouseProfile's beds tab).
  return (
    <button type="button" onClick={() => onViewTree(bed)}
      className="group flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3 text-left shadow-sm transition-all hover:-translate-y-1 hover:border-slate-200 hover:shadow-xl">
      {img
        ? <img src={img} alt={bed.name} className="h-14 w-14 flex-none rounded-xl object-cover" />
        : moonTile('h-14 w-14')}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-slate-800">{bed.name}</p>
        <p className="truncate text-[11px] text-slate-400">{bed.body ? bed.body.slice(0, 60) : 'A place to sleep'}</p>
      </div>
      <span className="flex-none text-slate-300 [&>svg]:h-4 [&>svg]:w-4 group-hover:text-slate-500"><Icons.ChevronRight /></span>
    </button>
  );
};

interface BedsBrowsePageProps {
  onViewTree: (t: Lifetree) => void;
  // LightHouse scope, derived exactly like the forest: a community domain shows its own houses,
  // the hub (null) shows them all.
  lightHouseDomain?: string | null;
  // The active node theme — passed so the header band resolves the SAME pigment the nav's
  // active pill does (both call tabTone('beds', theme)); without it they drift on a themed node.
  theme?: TabTheme | null;
  // The full-width tab strip above the band (beds live inside the Offerings page as a sub-tab).
  tabs?: ReactNode;
}

export const BedsBrowsePage = ({ onViewTree, lightHouseDomain = null, theme = null, tabs }: BedsBrowsePageProps) => {
  const { t } = useLanguage();
  const { lightseed } = useSession();
  const [density, setDensity] = useListDensity('beds');
  const [search, setSearch] = useState('');

  // Every Light House the viewer may see (already gated by canViewLightHouse + publicOnly when
  // signed out). Beds stack beneath each — the mirror of Light Houses stacking under communities.
  const lightHouses = useVisibleLightHouses(lightHouseDomain, 0);
  const bedsSignal = useRefreshSignal(['beds']);

  const [groups, setGroups] = useState<BedGroup[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- show the loader while the beds refetch (scope/signal change)
    setLoading(true);
    Promise.all(
      lightHouses.map(house =>
        getBedsForLightHouse(house.id)
          .then(beds => ({ house, beds }))
          .catch(() => ({ house, beds: [] as Lifetree[] })),
      ),
    ).then(all => {
      if (!alive) return;
      // Houses with no beds drop away — only lit rooms remain.
      setGroups(all.filter(g => g.beds.length > 0));
      setLoading(false);
    });
    return () => { alive = false; };
  }, [lightHouses, bedsSignal]);

  // Search reads both floors: a house name keeps all its beds; otherwise the bed's own name/body.
  const term = search.trim().toLowerCase();
  const visibleGroups = term
    ? groups
        .map(g => {
          if (g.house.name.toLowerCase().includes(term)) return g;
          const beds = g.beds.filter(b => `${b.name || ''} ${b.body || ''}`.toLowerCase().includes(term));
          return { house: g.house, beds };
        })
        .filter(g => g.beds.length > 0)
    : groups;

  const tone = tabTone('beds', theme);

  return (
    // No max-w/px/pt here: beds now render inside the Offerings page's <main>, which already
    // provides the width, gutters and top padding. And NO overflow-x-hidden: it computes
    // overflow-y to auto, turning this div into a clip box that would shear off the top 24px
    // the SectionHeader's -mt-6 pulls above it (the half-cut tab labels). Match PulseFeedPage.
    <div className="animate-in fade-in duration-500">
      <SectionHeader
        title={t('beds')}
        tone={tone}
        tabs={tabs}
        toggle={<ViewDensityToggle value={density} onChange={setDensity} />}
        footer={
          <div className="relative w-full">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400"><Icons.Search /></div>
            <input
              dir="auto"
              type="text"
              className="block w-full rounded-xl border border-emerald-100 bg-white/80 py-2 pl-10 pr-3 leading-5 text-slate-900 placeholder-slate-400 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 sm:text-sm"
              placeholder="Search beds and Light Houses..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        }
      >
        <ListBox tone={tone}>
          {!lightseed && (
            <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-center text-sm text-amber-700">
              Sign in to find a place to sleep; beds reach as far as the node, no further.
            </p>
          )}
          {loading ? (
            <div className="flex justify-center py-24"><Loading /></div>
          ) : visibleGroups.length === 0 ? (
            <p className="py-16 text-center text-slate-500">{term ? 'No beds match your search.' : 'No beds yet.'}</p>
          ) : (
            <div className="space-y-8">
              {visibleGroups.map(({ house, beds }) => (
                <section key={house.id}>
                  {/* The Light House header — its small face and name, the beds stacked beneath. */}
                  <div className="mb-3 flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-amber-200 bg-[#04070f]">
                      <img src={house.imageUrl || '/lighthouse.webp'} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-slate-800">{house.name}</p>
                      {(house.locationName || house.domain) && (
                        <p className="truncate text-[11px] text-slate-400">{house.locationName || house.domain}</p>
                      )}
                    </div>
                    <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-700">
                      {beds.length} {beds.length === 1 ? 'bed' : 'beds'}
                    </span>
                  </div>
                  <div className={densityGridClass(density)}>
                    {beds.map(bed => (
                      <BedCard key={bed.id} bed={bed} onViewTree={onViewTree} density={density} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </ListBox>
      </SectionHeader>
    </div>
  );
};
