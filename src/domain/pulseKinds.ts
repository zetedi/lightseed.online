import { normalizePulseType, type PulseType } from './pulse';

// THE KINDS A BEING SIFTS ITS OWN PULSES BY (ring 2026-09-10). A profile's Pulses tab holds
// everything a being ever emitted, which is exactly why it needs a sieve. The law here says
// only which kinds are OFFERED as a filter and what each is called — the words themselves live
// in translations.ts, reached through a typed key (a kind without words fails compilation).
//
// Plain contract — guaranteed: pulseKinds answers the kinds actually present in a list, in the
// canonical order below, legacy casing normalised (domain/pulse); matchesKind says whether a
// pulse belongs to a chosen kind, and every pulse matches the absent choice (null = all).
// Enforced by tests/pulseKinds.test.ts. Not guaranteed: no kind is hidden from a being here —
// this is a sieve for the eye, never a permission (visibility is domain/pulseVisibility's).
export const PULSE_KIND_ORDER: readonly PulseType[] = [
  'tree_growth', 'vision_growth', 'offering', 'event', 'observation',
  'translation', 'validation', 'request', 'dream', 'standard', 'reach',
];

export const pulseKindLabelKey = (kind: PulseType) => `pulse_kind_${kind}` as const;

// The kinds present in a list, in canonical order (an unknown kind falls in at the end).
export const pulseKinds = (types: readonly (string | undefined)[]): PulseType[] => {
  const present = new Set(types.map(t => normalizePulseType(t)));
  const known = PULSE_KIND_ORDER.filter(k => present.has(k));
  const rest = [...present].filter(k => !PULSE_KIND_ORDER.includes(k)).sort();
  return [...known, ...rest];
};

export const matchesKind = (type: string | undefined, kind: PulseType | null): boolean =>
  kind === null || normalizePulseType(type) === kind;
