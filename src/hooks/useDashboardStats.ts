import { useState, useEffect } from 'react';
import { getMyPulseCount, getMyVisionCount, getMyAlignmentCount } from '../services/firebase';
import type { Lightseed } from '../types';

// The dashboard's {pulses, visions, alignments} counts. Uses server-side COUNT aggregations (a
// handful of reads) instead of downloading every pulse/vision/alignment doc just to measure
// length — previously that whole history was re-fetched on every tab change. Still refreshes on
// tab change so newly-created items show up, but now that costs ~4 reads, not the full history.
export function useDashboardStats(lightseed: Lightseed | null, tab: string) {
  const [stats, setStats] = useState({ pulses: 0, visions: 0, alignments: 0 });
  useEffect(() => {
    if (!lightseed) { setStats({ pulses: 0, visions: 0, alignments: 0 }); return; }
    let alive = true;
    Promise.all([
      getMyPulseCount(lightseed.uid),
      getMyVisionCount(lightseed.uid),
      getMyAlignmentCount(lightseed.uid),
    ]).then(([pulses, visions, alignments]) => {
      if (alive) setStats({ pulses, visions, alignments });
    }).catch(console.error);
    return () => { alive = false; };
  }, [lightseed, tab]); // Re-fetch when tab changes to refresh counts
  return stats;
}
