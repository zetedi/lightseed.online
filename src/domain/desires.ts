import { isLanguage, type Language } from './tongues';

// DESIRES (ring 2026-09-18). A being carries wishes that should follow it wherever it stands:
// on this phone, on that laptop, at any door. The first desire is the TONGUE it reads in.
// Before this the chosen tongue lived in one browser's localStorage and stayed there; now it
// is written on the person (users/{uid}.desires) when chosen while signed in, and read back
// at sign-in on any device, where it wins over what that browser remembered. Light has
// desires, maybe; a being certainly does.
//
// Plain contract — guaranteed: desiresOf reads only known desires and only lawful values (a
// tongue must be one the shell speaks), dropping the rest; tongueToWear returns the desire
// when there is one, else what the browser remembered. Not guaranteed: that the server speaks
// the tongue (letters still go out in English — the next rung), or that a desire exists (a
// being who never chose while signed in has none, and each browser keeps its own memory).

export interface Desires { tongue?: Language }
export const DESIRE_KEYS = ['tongue'] as const;

export const desiresOf = (raw: unknown): Desires => {
  const out: Desires = {};
  if (raw && typeof raw === 'object') {
    const tongue = (raw as { tongue?: unknown }).tongue;
    if (isLanguage(tongue)) out.tongue = tongue;
  }
  return out;
};

export const tongueToWear = (desired: Language | undefined | null, remembered: Language): Language =>
  desired ?? remembered;
