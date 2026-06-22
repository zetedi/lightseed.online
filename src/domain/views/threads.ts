import type { Pulse } from '../pulse';

// A conversation summary — a thread is a reach-edge between two trees, refracted into a
// last-message + unread view. `lastMessage`/`lastAt` reflect all messages; `unread` counts
// only messages addressed to the viewer that they haven't seen.
export interface ReachThread {
  partnerId: string;
  partnerName: string;
  partnerPhoto?: string;
  lastMessage: string;
  lastAt: number;
  unread: number;
}

export interface ThreadViewer {
  uid?: string | null;
  treeIds: string[]; // the viewer's own tree ids — a reach from one of these is "outgoing"
}

// Pure prism: reach pulses → conversation threads. No backend, no React — another facet
// the same LIN refracts into (here the reach-edges between trees).
export function reachThreads(pulses: Pulse[], viewer: ThreadViewer): ReachThread[] {
  const myIds = new Set(viewer.treeIds);
  const uid = viewer.uid || undefined;
  const map = new Map<string, ReachThread>();

  for (const p of pulses) {
    const reachId = p.reachTreeId || (p as any).chatTreeId;
    const reachName = p.reachTreeName || (p as any).chatTreeName;
    // Outgoing if I authored it, or it originates from one of my trees.
    const outgoing = (!!uid && p.authorId === uid) || myIds.has(p.lifetreeId || '');

    let partnerId: string | undefined;
    let partnerName: string | undefined;
    let partnerPhoto: string | undefined;
    if (outgoing) {
      partnerId = reachId;
      partnerName = reachName;
    } else {
      partnerId = p.lifetreeId;
      partnerName = p.authorName;
      partnerPhoto = p.authorPhoto;
    }
    if (!partnerId) continue;

    const at = p.createdAt?.toMillis?.() || 0;
    // Newest utterance: the reply if present, otherwise the message.
    const text = p.reachResponse || p.content || p.body || '';
    // Unread = addressed to me, authored by someone else, and not yet seen.
    const isUnread = !!uid && p.recipientUid === uid && p.authorId !== uid && !(p.seenBy || []).includes(uid);
    const existing = map.get(partnerId);
    if (!existing) {
      map.set(partnerId, {
        partnerId,
        partnerName: partnerName || 'Lifetree',
        partnerPhoto,
        lastMessage: text,
        lastAt: at,
        unread: isUnread ? 1 : 0,
      });
    } else {
      if (isUnread) existing.unread += 1;
      if (at >= existing.lastAt) {
        existing.lastAt = at;
        existing.lastMessage = text;
      }
      if (!existing.partnerPhoto && partnerPhoto) existing.partnerPhoto = partnerPhoto;
    }
  }
  return Array.from(map.values()).sort((a, b) => b.lastAt - a.lastAt);
}
