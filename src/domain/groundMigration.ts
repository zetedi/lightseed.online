import type { DomainKey } from './words';
import { groundRefusal, MAX_VISIONS_PER_TREE } from './grounding';

// THE OLD TIE BECOMES A GROUND (ring 2026-11-17, step 4: the plan). Before that ring a vision
// named its tree in a field (`lifetreeId`); now a vision stands in a tree by a consented link
// (domain/grounding). This is the PLAN for carrying every old field across — pure, so the origin's
// script and the independent node's audit read the same answer from the same facts. It writes
// nothing and it decides nothing irreversible: the apply is a separate act, taken on the
// guardian's word after this plan has been read.
//
// THE APPLY, as the keeper decided it on 2026-11-18 (`groundMigrationActs`):
//   - LINKS ALONE. A grounding done today writes one block on each chain; these grounds were never
//     asked and answered, so no block is written saying they were. The link carries `migrated`.
//   - A vision whose field names a tree that is gone has the field CLEARED: it stands on its own,
//     seeking ground, still its author's words.
//   - A grounded vision KEEPS its field until every reader has moved to the link (step 5).
//   - needs_yes, refused, tree_full and already are left exactly as they are.
//
// What the plan will and will not do for each vision that carries the field:
//   ground      the tree may ground it AND its author cares for the tree (anchor, keeper or
//               steward) — one being standing on both sides, so the consent the law asks for is
//               already there. Marked `self`; marked `birth` when it is the tree's Root Vision.
//   needs_yes   the tree may ground it, but its author is no carer of that tree: nobody who
//               speaks for the tree ever agreed. No ground is written; the honest act is a knock
//               the tree's carers answer.
//   refused     the law forbids this ground today (a private vision or tree, a secret tree, a
//               bed, a tree that died, a tree seen less far than the vision). It keeps its old
//               field until the law has a room for it. `refusal` says why.
//   tree_gone   the field names a tree that no longer exists.
//   tree_full   the tree already grounds twelve; later visions wait.
//   already     a ground between the two already stands.
//
// THE ROOT VISION: among the visions of one tree that are titled "Root Vision" and voiced by the
// tree's anchor, the eldest is the birth ground. A tree has at most one.

export interface MigrationVision {
  id: string;
  authorId: string;
  title?: string | null;
  visibility?: string | null;
  lifetreeId?: string | null;
  createdAtMs?: number | null;
}
export interface MigrationTree {
  id: string;
  anchorUid: string;
  treeType?: string | null;
  visibility?: string | null;
  diedAtMs?: number | null;
  carerUids: readonly string[];   // keeper and steward links (the anchor is read from anchorUid)
}
export type GroundMigrationVerdict = 'ground' | 'needs_yes' | 'refused' | 'tree_gone' | 'tree_full' | 'already';
export interface GroundMigrationRow {
  visionId: string;
  treeId: string;
  verdict: GroundMigrationVerdict;
  refusal?: DomainKey;
  self: boolean;
  birth: boolean;
}
export interface GroundMigrationPlan {
  rows: GroundMigrationRow[];
  counts: Record<GroundMigrationVerdict, number> & { visions: number; withoutField: number; births: number };
  refusals: Partial<Record<DomainKey, number>>;
}

const isRootTitle = (title: string | null | undefined): boolean => (title ?? '').trim().toLowerCase() === 'root vision';
const byAge = (a: MigrationVision, b: MigrationVision): number =>
  (a.createdAtMs ?? Infinity) - (b.createdAtMs ?? Infinity) || a.id.localeCompare(b.id);

export function planGroundMigration(
  visions: readonly MigrationVision[],
  trees: readonly MigrationTree[],
  standing: readonly { visionId: string; treeId: string }[],
): GroundMigrationPlan {
  const treeById = new Map(trees.map(t => [t.id, t]));
  const stands = new Set(standing.map(g => `${g.visionId}\n${g.treeId}`));
  const grounded = new Map<string, number>();
  for (const g of standing) grounded.set(g.treeId, (grounded.get(g.treeId) ?? 0) + 1);
  const bornAt = new Set<string>();   // trees whose birth ground this plan has already given

  const rows: GroundMigrationRow[] = [];
  const counts = { ground: 0, needs_yes: 0, refused: 0, tree_gone: 0, tree_full: 0, already: 0, visions: visions.length, withoutField: 0, births: 0 };
  const refusals: Partial<Record<DomainKey, number>> = {};

  // Eldest first, so the eldest Root Vision is the birth and the caps fill in the order of birth.
  for (const vision of [...visions].sort(byAge)) {
    const treeId = typeof vision.lifetreeId === 'string' ? vision.lifetreeId : '';
    if (!treeId) { counts.withoutField++; continue; }
    const row = (verdict: GroundMigrationVerdict, extra: Partial<GroundMigrationRow> = {}): void => {
      rows.push({ visionId: vision.id, treeId, verdict, self: false, birth: false, ...extra });
      counts[verdict]++;
    };
    const tree = treeById.get(treeId);
    if (!tree) { row('tree_gone'); continue; }
    if (stands.has(`${vision.id}\n${treeId}`)) { row('already'); continue; }
    const refusal = groundRefusal(tree, vision);
    if (refusal) { refusals[refusal] = (refusals[refusal] ?? 0) + 1; row('refused', { refusal }); continue; }
    const cares = !!vision.authorId && (tree.anchorUid === vision.authorId || tree.carerUids.includes(vision.authorId));
    if (!cares) { row('needs_yes'); continue; }
    if ((grounded.get(treeId) ?? 0) >= MAX_VISIONS_PER_TREE) { row('tree_full'); continue; }
    const birth = isRootTitle(vision.title) && tree.anchorUid === vision.authorId && !bornAt.has(treeId);
    if (birth) { bornAt.add(treeId); counts.births++; }
    grounded.set(treeId, (grounded.get(treeId) ?? 0) + 1);
    row('ground', { self: true, birth });
  }
  return { rows, counts, refusals };
}

// What the apply writes, and nothing else: a ground for every `ground` row, the field cleared for
// every `tree_gone` row. Both soils carry out exactly this list, each act re-proved where it lands.
export interface GroundMigrationActs {
  grounds: { visionId: string; treeId: string; birth: boolean }[];
  cleared: { visionId: string; treeId: string }[];
}
export const groundMigrationActs = (plan: Pick<GroundMigrationPlan, 'rows'>): GroundMigrationActs => ({
  grounds: plan.rows.filter(r => r.verdict === 'ground').map(r => ({ visionId: r.visionId, treeId: r.treeId, birth: r.birth })),
  cleared: plan.rows.filter(r => r.verdict === 'tree_gone').map(r => ({ visionId: r.visionId, treeId: r.treeId })),
});

// The fields a migrated ground carries beside from/rel/to. `self`: one being stood on both sides.
// `migrated`: this ground was carried across from the old field, not asked and answered — which is
// why it names no pair of blocks (a ground made by the hands names its two, `groundedPulseIds`).
export const migratedGroundFields = (authorId: string, birth: boolean) =>
  ({ self: true, birth, requestedBy: authorId, acceptedBy: authorId, migrated: true }) as const;

// THE FIELD RETIRED (step 5, ring 2026-11-18). Once every reader finds a vision's tree through its
// grounds, the old `lifetreeId` says nothing the link does not. It is removed ONLY from a vision
// whose ground in that very tree stands — the link has taken its place. Any other vision still
// carrying the field (the law refused its ground, it needs a yes, its tree was full) KEEPS it: the
// field is then the only record of where it once belonged, and a human decides.
export interface FieldRetirement {
  retire: { visionId: string; treeId: string }[];
  keep: { visionId: string; treeId: string }[];
}
export function planFieldRetirement(
  visions: readonly Pick<MigrationVision, 'id' | 'lifetreeId'>[],
  standing: readonly { visionId: string; treeId: string }[],
): FieldRetirement {
  const stands = new Set(standing.map(g => `${g.visionId}\n${g.treeId}`));
  const out: FieldRetirement = { retire: [], keep: [] };
  for (const vision of [...visions].sort((a, b) => a.id.localeCompare(b.id))) {
    const treeId = typeof vision.lifetreeId === 'string' ? vision.lifetreeId : '';
    if (!treeId) continue;
    (stands.has(`${vision.id}\n${treeId}`) ? out.retire : out.keep).push({ visionId: vision.id, treeId });
  }
  return out;
}
