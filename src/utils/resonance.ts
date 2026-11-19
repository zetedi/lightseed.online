import type { VisionSynergy } from '../types';

// A stable, order-insensitive id for a resonance pair (used to track favourites).
export const resonanceId = (s: VisionSynergy) =>
  [s.vision1Title, s.vision2Title].map(x => (x || '').trim().toLowerCase()).sort().join(' :: ');
