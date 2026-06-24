import type { Pulse } from '../pulse';
import type { ReachAudience } from '../reach';

// A conversation summary — a 1:1 reach-edge between two trees, OR a group reach to a slice
// of a tree's circle, refracted into a last-message + unread view. `lastMessage`/`lastAt`
// reflect all messages; `unread` counts only messages addressed to the viewer (by another
// person) that they haven't seen.
export interface ReachThread {
  key: string;          // unique per thread: threadId for groups, partner tree id for 1:1
  threadId?: string;    // present for group threads (and new 1:1 reaches) — how to open them
  isGroup: boolean;
  partnerId: string;    // the other tree (1:1) or the subject tree the group is about
  partnerName: string;
  partnerPhoto?: string;
  audience?: ReachAudience; // for group threads, which slice of the circle
  participantCount?: number;
  lastMessage: string;
  lastAt: number;
  unread: number;
}

export interface ThreadViewer {
  uid?: string | null;
  treeIds: string[]; // the viewer's own tree ids — a reach from one of these is "outgoing"
}

// Pure prism: reach pulses → conversation threads. No backend, no React — another facet
// the same LIN refracts into (here the reach-edges and reach-circles between trees).
export function reachThreads(pulses: Pulse[], viewer: ThreadViewer): ReachThread[] {
  const myIds = new Set(viewer.treeIds);
  const uid = viewer.uid || undefined;
  const map = new Map<string, ReachThread>();

  for (const p of pulses) {
    const at = p.createdAt?.toMillis?.() || 0;
    // Newest utterance: the inline reply if present, otherwise the message body.
    const text = p.reachResponse || p.content || p.body || '';
    // Unread = addressed to me (1:1 recipient or a group participant), authored by someone
    // else, and not yet seen.
    const participantUids = p.participantUids || [];
    const addressedToMe = !!uid && (p.recipientUid === uid || participantUids.includes(uid));
    const isUnread = addressedToMe && p.authorId !== uid && !(p.seenBy || []).includes(uid);

    const isGroup = p.isGroup === true || participantUids.length > 2;

    let key: string;
    let partnerId: string | undefined;
    let partnerName: string | undefined;
    let partnerPhoto: string | undefined;

    if (isGroup) {
      // Group threads are keyed by their stable threadId; the "partner" is the subject tree.
      key = p.threadId || `${p.reachTreeId || ''}__group`;
      partnerId = p.reachTreeId || (p as any).chatTreeId;
      partnerName = p.threadName || p.reachTreeName;
    } else {
      // 1:1: outgoing if I authored it or it came from one of my trees → partner is the
      // reached tree; otherwise the partner is the author's tree.
      const outgoing = (!!uid && p.authorId === uid) || myIds.has(p.lifetreeId || '');
      if (outgoing) {
        partnerId = p.reachTreeId || (p as any).chatTreeId;
        partnerName = p.reachTreeName || (p as any).chatTreeName;
      } else {
        partnerId = p.lifetreeId;
        partnerName = p.authorName;
        partnerPhoto = p.authorPhoto;
      }
      key = partnerId || '';
    }
    if (!partnerId || !key) continue;

    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        key,
        threadId: p.threadId,
        isGroup,
        partnerId,
        partnerName: partnerName || (isGroup ? 'Circle' : 'Lifetree'),
        partnerPhoto,
        audience: p.audience,
        participantCount: isGroup ? participantUids.length : undefined,
        lastMessage: text,
        lastAt: at,
        unread: isUnread ? 1 : 0,
      });
    } else {
      if (isUnread) existing.unread += 1;
      if (at >= existing.lastAt) {
        existing.lastAt = at;
        existing.lastMessage = text;
        if (p.threadId) existing.threadId = p.threadId;
        if (isGroup) existing.participantCount = participantUids.length;
      }
      if (!existing.partnerPhoto && partnerPhoto) existing.partnerPhoto = partnerPhoto;
    }
  }
  return Array.from(map.values()).sort((a, b) => b.lastAt - a.lastAt);
}
