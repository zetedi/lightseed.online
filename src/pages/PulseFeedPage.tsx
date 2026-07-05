import React from 'react';
import { SectionHeader } from '../components/ui/SectionHeader';
import { PulseCard } from '../components/PulseCard';
import type { Pulse, Lightseed } from '../types';

// A presentational feed of PulseCards under a SectionHeader. Shared by the Events and Pulses
// tabs (near-identical grids) — extracted from App so the shell just supplies data + handlers.
interface PulseFeedPageProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
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
  icon, title, subtitle, searchBox, action, items, emptyText, loadingMore, lightseed, onMatch, onView, pattern,
}: PulseFeedPageProps) => (
  <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
    <SectionHeader icon={icon} title={title} subtitle={subtitle} footer={searchBox} action={action} pattern={pattern}>
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {items.length === 0 && !loadingMore ? (
          <p className="col-span-full py-10 text-center text-slate-400">{emptyText}</p>
        ) : (
          items.map(item => (
            <div key={item.id}>
              <PulseCard pulse={item} lightseed={lightseed} onMatch={onMatch} onView={onView} />
            </div>
          ))
        )}
      </div>
    </SectionHeader>
  </div>
);
