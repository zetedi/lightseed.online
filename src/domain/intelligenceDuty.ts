import type { DomainKey } from './words';

// THE DUTIES (ring 2026-09-08). An entity — a person, a community — does not have ONE
// intelligence; it has work of several kinds, and may order a different intelligence to
// each: the oracle's whispers to one, the watering witness to another, the heart-to-heart
// translation to a third. A duty is a kind of work the shell asks an intelligence to do.
// Unassigned work goes to the one LISTENING (the entity's preferred intelligence), and
// failing that to the node's default — so nothing changes for an entity that orders none.
//
// Plain contract — guaranteed: INTELLIGENCE_DUTIES is the closed list every call site names
// from; intelligenceForDuty answers assignment → preferred → fallback, never undefined when a
// fallback is given; assignDuty returns a new map with the duty set or cleared and never a
// key outside the list. Enforced by tests/intelligenceDuty.test.ts.
export const INTELLIGENCE_DUTIES = ['whisper', 'tree_talk', 'watering', 'translation', 'resonance', 'insight', 'writing'] as const;
export type IntelligenceDuty = (typeof INTELLIGENCE_DUTIES)[number];
export type DutyAssignment = Partial<Record<IntelligenceDuty, string>>;

export const isIntelligenceDuty = (v: unknown): v is IntelligenceDuty =>
  typeof v === 'string' && (INTELLIGENCE_DUTIES as readonly string[]).includes(v);

// The word for each duty — a domain key, spoken by the app in the reader's tongue.
export const DUTY_LABEL_KEY: Record<IntelligenceDuty, DomainKey> = {
  whisper: 'duty_whisper',
  tree_talk: 'duty_tree_talk',
  watering: 'duty_watering',
  translation: 'duty_translation',
  resonance: 'duty_resonance',
  insight: 'duty_insight',
  writing: 'duty_writing',
};

// Which intelligence serves a duty: the one ordered to it, else the one listening, else the fallback.
export function intelligenceForDuty(byDuty: DutyAssignment | null | undefined, duty: IntelligenceDuty | undefined, preferred: string | undefined, fallback: string): string;
export function intelligenceForDuty(byDuty: DutyAssignment | null | undefined, duty: IntelligenceDuty | undefined, preferred: string | undefined): string | undefined;
export function intelligenceForDuty(byDuty: DutyAssignment | null | undefined, duty: IntelligenceDuty | undefined, preferred: string | undefined, fallback?: string): string | undefined {
  const ordered = duty && byDuty ? byDuty[duty] : undefined;
  return (typeof ordered === 'string' && ordered) || preferred || fallback;
}

// Order an intelligence to a duty (or clear it with null) — a new map, the rest untouched.
export const assignDuty = (byDuty: DutyAssignment | null | undefined, duty: IntelligenceDuty, intelligenceId: string | null): DutyAssignment => {
  const next: DutyAssignment = {};
  for (const d of INTELLIGENCE_DUTIES) if (byDuty && typeof byDuty[d] === 'string' && byDuty[d]) next[d] = byDuty[d];
  if (intelligenceId) next[duty] = intelligenceId; else delete next[duty];
  return next;
};

// The duties an intelligence is ordered to, for its card.
export const dutiesOf = (byDuty: DutyAssignment | null | undefined, intelligenceId: string): IntelligenceDuty[] =>
  INTELLIGENCE_DUTIES.filter((d) => byDuty?.[d] === intelligenceId);
