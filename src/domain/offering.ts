// OFFERINGS — a being offers a BED or a SERVICE and may name the light with which they hope the
// contribution will be appreciated AFTER it is received. Trust admits; the ray follows the dream.
// The suggestion is an agreement, never a gate or purchase price. This module is the pure law for
// a sound offering draft; circulation itself remains a coming rung.

export type OfferingKind = 'bed' | 'service';

export interface OfferingDraft {
    kind: OfferingKind;
    title: string;
    description: string;
    suggestedAppreciationLight: number; // whole light units; an after-gift, never admission
    bedId?: string;     // for a bed offering, the bed being it stands for (optional)
}

// Why this offering cannot stand yet, or null when it may. Keeps the form honest before a write.
export const offeringProblem = (d: OfferingDraft): string | null => {
    if (d.kind !== 'bed' && d.kind !== 'service') return 'Choose what you are offering.';
    if (!d.title.trim()) return 'Name your offering.';
    if (!Number.isFinite(d.suggestedAppreciationLight) || d.suggestedAppreciationLight <= 0) return 'Suggest an appreciation in light (more than zero).';
    if (!Number.isInteger(d.suggestedAppreciationLight)) return 'Appreciation is expressed in whole light units.';
    return null;
};
