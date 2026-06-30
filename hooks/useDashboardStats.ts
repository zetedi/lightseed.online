import { useState, useEffect } from 'react';
import { getMyPulses, getMyVisions, getMyAlignmentsHistory } from '../services/firebase';
import type { Lightseed } from '../types';

// The dashboard's {pulses, visions, alignments} counts. Re-fetches on auth identity change AND on
// every tab change (to refresh counts) — deps kept exactly as the original [lightseed, tab].
export function useDashboardStats(lightseed: Lightseed | null, tab: string) {
  const [stats, setStats] = useState({ pulses: 0, visions: 0, alignments: 0 });
  useEffect(() => {
    if (lightseed) {
      Promise.all([
        getMyPulses(lightseed.uid),
        getMyVisions(lightseed.uid),
        getMyAlignmentsHistory(lightseed.uid),
      ]).then(([p, v, m]) => {
        setStats({ pulses: p.length, visions: v.length, alignments: m.length });
      }).catch(console.error);
    } else {
      setStats({ pulses: 0, visions: 0, alignments: 0 });
    }
  }, [lightseed, tab]); // Re-fetch when tab changes to refresh counts
  return stats;
}
