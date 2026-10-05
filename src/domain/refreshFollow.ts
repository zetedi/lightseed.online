// AN EDIT IS SEEN WHERE IT STANDS (ring 2026-10-05). A mutation announces itself on the refresh
// bus (services/refreshBus): a topic, the doc id, and — for an edit — the patch. A view holding a
// copy of that being answers in ONE of three ways, and this is the law of which:
//   merge  — the announcement names this being and carries a patch: lay the patch over the copy;
//   reread — it names this being but carries no patch (the announcer did not know, or could not
//            say, what changed): read the document again and take it whole;
//   keep   — it names another being, or nothing: do nothing.
// A view that holds a LIST, not one being, re-fetches on any announcement of its topics
// (hooks/useRefreshSignal) — the whisper that was already there; this law is for the OPEN being.
export type FollowAction =
  | { kind: 'keep' }
  | { kind: 'merge'; patch: Record<string, unknown> }
  | { kind: 'reread' };

export const followEdit = (
  openId: string | null | undefined,
  announced: { id?: string; patch?: Record<string, unknown> },
): FollowAction => {
  if (!openId || !announced.id || announced.id !== openId) return { kind: 'keep' };
  if (announced.patch) return { kind: 'merge', patch: announced.patch };
  return { kind: 'reread' };
};
