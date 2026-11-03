// THE ALIGNMENT A SYNC BLOCK NAMES (ring 2026-11-03): one law, lifted from the two backends' twin
// copies, for the match-id backfill the node grows as its own repair. Among a tree's ACCEPTED
// alignments, the newest proposed before the block's moment names it; when none was proposed
// before (a legacy block older than its own alignment), the newest accepted at all. Duplicates by
// id (a tree stands on both sides of nothing, but a reader may hand the same alignment twice) are
// one alignment. Pure: the moments are plain milliseconds.
export interface AlignmentCandidate { id: string; status: string; createdAtMs: number }

export const alignmentForSyncBlock = <T extends AlignmentCandidate>(alignments: readonly T[], blockAtMs?: number): T | null => {
  const byId = new Map<string, T>();
  for (const alignment of alignments) byId.set(alignment.id, alignment);
  const accepted = [...byId.values()].filter(alignment => alignment.status === 'ACCEPTED');
  if (accepted.length === 0) return null;
  const at = blockAtMs ?? Number.POSITIVE_INFINITY;
  const before = accepted.filter(alignment => alignment.createdAtMs <= at);
  return [...(before.length > 0 ? before : accepted)].sort((a, b) => b.createdAtMs - a.createdAtMs)[0] ?? null;
};
