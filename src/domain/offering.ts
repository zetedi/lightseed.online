import { RAY_UNITS } from './light';

// OFFERINGS — a being offers a BED or a SERVICE for light (the spending side of the sun economy;
// ring 2026-07-19). An offering is a pulse of type 'offering' priced in light units. This module
// is the pure law: what a valid offering draft is, and how a light price reads to a human. The
// exchange itself (a buyer's light moving to the offerer through the prism) is a coming rung;
// posting and browsing offerings is what stands here.

export type OfferingKind = 'bed' | 'service';

export interface OfferingDraft {
    kind: OfferingKind;
    title: string;
    description: string;
    priceLight: number; // in light units (RAY_UNITS = one ray)
    bedId?: string;     // for a bed offering, the bed being it stands for (optional)
}

// Why this offering cannot stand yet, or null when it may. Keeps the form honest before a write.
export const offeringProblem = (d: OfferingDraft): string | null => {
    if (d.kind !== 'bed' && d.kind !== 'service') return 'Choose what you are offering.';
    if (!d.title.trim()) return 'Name your offering.';
    if (!Number.isFinite(d.priceLight) || d.priceLight <= 0) return 'Set a price in light (more than zero).';
    if (!Number.isInteger(d.priceLight)) return 'The light price is whole units.';
    return null;
};

// A light price spoken for humans: whole rays where it divides, else the unit count. One ray is
// RAY_UNITS; "a ray" reads better than "108 units" when it lands exactly.
export const formatLightPrice = (units: number): string => {
    if (!Number.isFinite(units) || units <= 0) return '0 light';
    if (units % RAY_UNITS === 0) {
        const rays = units / RAY_UNITS;
        return `${rays} ray${rays === 1 ? '' : 's'}`;
    }
    return `${units} light`;
};
