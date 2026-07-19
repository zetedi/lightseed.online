import { isBedTree } from './bed';
import { isWateringOverdue } from './watering';
import type { Lifetree } from './lifetree';

// THE SUSTAINING SEVEN (the ring of 2026-07-19) — every being's floor within the
// Earth-horizon: seven trees planted and tended, by their planter or through guardians,
// roughly what a body asks of the living world. Each of the seven needs a WITNESS: a
// guardian besides the planter, because unwitnessed care cannot kindle (the sun ring's
// law), and inviting witnesses is how tree circles begin to weave communities.
//
// Pure module: which of my planted trees stand sustaining, and what each still lacks
// (a witness, a watering). Invited, never enforced: this measures a floor, it gates
// nothing. The face lives on the profile; the Light Path milestone and the circle-graph
// door come in their own rungs (see ROADMAP).

export const SUSTAINING_SEVEN = 7;

// The LIN edge that witnesses a tree: someone __guardian__ tree. Only the fields the
// counting needs — callers map real link docs down to this.
export interface GuardianEdge {
  from: string; // the guardian's uid
  to: string;   // the tree's id
}

export interface SevenStanding {
  treeId: string;
  name: string;
  // At least one guardian besides the planter. The planter's own guardian link (minted
  // on nature trees, possible anywhere) is a vow, not a witness: witness means another.
  witnessed: boolean;
  // Watering not overdue. A self-sustaining tree, and one not yet on a schedule, count
  // as tended — the rhythm belongs to the tree, not to a timer (isWateringOverdue).
  tended: boolean;
  sustaining: boolean; // witnessed && tended
}

export interface SustainingSevenProgress {
  target: number;             // SUSTAINING_SEVEN
  planted: number;            // personal lifetrees considered (not guarded, not beds)
  sustaining: number;         // trees both witnessed and tended
  complete: boolean;          // sustaining >= target
  standings: SevenStanding[]; // every planted tree in planting order, with its lacks
}

// A tree the being PLANTED as their own: not a bed (furniture), not a guarded/nature
// tree (stood for, not planted for oneself), owned by the planter.
const isGuardedTree = (t: Pick<Lifetree, 'treeType' | 'isNature'>): boolean =>
  t.treeType === 'GUARDED' || (!t.treeType && t.isNature === true);

const plantedBy = (t: Lifetree, uid: string): boolean =>
  !isBedTree(t) && !isGuardedTree(t) && t.ownerId === uid;

const toMs = (t: any): number => (t?.toMillis ? t.toMillis() : 0);

// The one reading the profile face, the coming Light Path milestone, and the tests share.
export const sustainingSeven = (
  trees: readonly Lifetree[],
  guardianEdges: readonly GuardianEdge[],
  planterUid: string,
  now: number = Date.now(),
): SustainingSevenProgress => {
  const witnessed = new Set<string>();
  for (const e of guardianEdges) {
    if (e.from !== planterUid) witnessed.add(e.to);
  }

  const standings = trees
    .filter(t => plantedBy(t, planterUid))
    .sort((a, b) => toMs(a.createdAt) - toMs(b.createdAt))
    .map<SevenStanding>(t => {
      const hasWitness = witnessed.has(t.id);
      const tended = !isWateringOverdue(t, now);
      return { treeId: t.id, name: t.name, witnessed: hasWitness, tended, sustaining: hasWitness && tended };
    });

  const sustaining = standings.filter(s => s.sustaining).length;
  return {
    target: SUSTAINING_SEVEN,
    planted: standings.length,
    sustaining,
    complete: sustaining >= SUSTAINING_SEVEN,
    standings,
  };
};
