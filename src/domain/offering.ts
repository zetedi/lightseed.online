import type { DomainKey } from './words';
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
    url?: string;       // an optional detail door (booking page, menu); http(s) only
}

// Why this offering cannot stand yet, or null when it may. Keeps the form honest before a write.
export const offeringProblem = (d: OfferingDraft): DomainKey | null => {
    if (d.kind !== 'bed' && d.kind !== 'service') return 'offering_choose_kind';
    if (!d.title.trim()) return 'offering_name';
    if (!Number.isFinite(d.suggestedAppreciationLight) || d.suggestedAppreciationLight <= 0) return 'offering_appreciation_positive';
    if (!Number.isInteger(d.suggestedAppreciationLight)) return 'offering_appreciation_whole';
    const url = d.url?.trim();
    if (url && !/^https?:\/\/\S+$/i.test(url)) return 'offering_link_http';
    if (url && url.length > 300) return 'offering_link_long';
    return null;
};
