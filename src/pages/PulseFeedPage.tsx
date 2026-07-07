import React from 'react';
import { SectionHeader } from '../components/ui/SectionHeader';
import { PulseCard } from '../components/PulseCard';
import { Loading } from '../components/ui/Loading';
import { ViewDensityToggle } from '../components/ui/ViewDensityToggle';
import { CloudBox } from '../components/ui/CloudBox';
import { useListDensity, densityGridClass } from '../hooks/useListDensity';
import type { Pulse, Lightseed } from '../types';

// A presentational feed of PulseCards under the coloured header band. Shared by the Events and
// Pulses tabs — the shell supplies data + handlers; the page owns its reading density (rows /
// cards / mini), remembered per tab.
interface PulseFeedPageProps {
  title: string;            // screen-reader name; shown in the mobile nav, not here
  tone: string;             // the active menu item's colour — band and pill are one surface
  densityKey: string;       // localStorage slot ('events' | 'pulses')
  searchBox?: React.ReactNode;
  action?: React.ReactNode;
  items: Pulse[];
  emptyText: string;
  loadingMore: boolean;
  lightseed: Lightseed | null;
  onMatch: (p: Pulse) => void;
  onView: (p: Pulse) => void;
  pattern?: boolean;
}

export const PulseFeedPage = ({
  title, tone, densityKey, searchBox, action, items, emptyText, loadingMore, lightseed, onMatch, onView, pattern,
}: PulseFeedPageProps) => {
  const [density, setDensity] = useListDensity(densityKey);
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
      <SectionHeader
        title={title}
        tone={tone}
        footer={searchBox}
        toggle={<ViewDensityToggle value={density} onChange={setDensity} />}
        action={action}
        pattern={pattern}
      >
        <CloudBox>
          <div className={densityGridClass(density)}>
            {items.length === 0 && !loadingMore ? (
              <p className="col-span-full py-10 text-center text-slate-400">{emptyText}</p>
            ) : (
              items.map(item => (
                <div key={item.id}>
                  <PulseCard pulse={item} lightseed={lightseed} onMatch={onMatch} onView={onView} density={density} />
                </div>
              ))
            )}
          </div>
          {loadingMore && <div className="mt-6 flex justify-center"><Loading /></div>}
        </CloudBox>
      </SectionHeader>
    </div>
  );
};
