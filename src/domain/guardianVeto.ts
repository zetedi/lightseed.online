// The guardians' veto — care has a conscience. The guardians of a tree may, in consensus,
// veto a growth mint (a tree_growth pulse: watering, care, growth). One objection alone
// pauses nothing; the veto stands only when EVERY eligible guardian casts it — the same
// unanimity a consensus council asks for, applied to a single pulse. The pulse is never
// deleted (the chain stays append-only): a vetoed mint is marked, and readers discount it.
//
// Pure module — the rules counterpart lets a guardian append exactly their own uid to the
// pulse's `vetoes` array (see firestore.rules, pulses clause (e)).

export const VETOABLE_TYPES: readonly string[] = ['tree_growth'];

// Three days of daylight: after that, the mint is settled history.
export const VETO_WINDOW_MS = 72 * 60 * 60 * 1000;

export interface VetoInput {
  pulseType: string;
  pulseAuthorId: string;
  pulseCreatedAtMs: number;
  guardianUids: string[]; // the tree's guardian edges (the LIN)
  vetoUids: string[];     // guardians who have cast a veto
  nowMs: number;
}

const unique = (xs: string[]) => [...new Set(xs)];

// The author's own guardianship never counts — no one weighs their own mint.
export const eligibleGuardians = (i: Pick<VetoInput, 'guardianUids' | 'pulseAuthorId'>): string[] =>
  unique(i.guardianUids).filter(uid => uid && uid !== i.pulseAuthorId);

export const validVetoes = (i: VetoInput): string[] => {
  const eligible = new Set(eligibleGuardians(i));
  return unique(i.vetoUids).filter(uid => eligible.has(uid));
};

// May this viewer cast a veto on this pulse, now?
export const canVeto = (i: VetoInput, viewerUid: string | undefined): boolean =>
  !!viewerUid &&
  VETOABLE_TYPES.includes(i.pulseType) &&
  i.nowMs - i.pulseCreatedAtMs <= VETO_WINDOW_MS &&
  eligibleGuardians(i).includes(viewerUid) &&
  !validVetoes(i).includes(viewerUid);

// Consensus reached: every eligible guardian has spoken, and there is at least one.
export const isVetoed = (i: VetoInput): boolean => {
  const eligible = eligibleGuardians(i);
  return eligible.length > 0 && validVetoes(i).length === eligible.length;
};

export const vetoProgress = (i: VetoInput): { cast: number; needed: number } => ({
  cast: validVetoes(i).length,
  needed: eligibleGuardians(i).length,
});
