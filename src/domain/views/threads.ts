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
  partnerPersonName?: string; // the human behind the partner tree (1:1), if they've written
  partnerPhoto?: string;
  audience?: ReachAudience; // for group threads, which slice of the circle
  participantCount?: number;
  lastMessage: string;
  lastAt: number;
  unread: number;
  // 'watering' when the thread's latest message is an unanswered "water me" alert — drives
  // the blue border in the inbox. Cleared once a later message (e.g. a watering confirmation)
  // becomes the newest, since that message carries no careAlert.
  careAlert?: 'watering';
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
    // A retracted message never previews its words — the marker is spoken by the UI (a key).
    const text = (p as { retractedAt?: unknown }).retractedAt ? '' : (p.reachResponse || p.content || p.body || '');
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
    let partnerPersonName: string | undefined;

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
        partnerPersonName = p.authorPersonName; // the human behind the partner tree
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
        partnerPersonName,
        partnerPhoto,
        audience: p.audience,
        participantCount: isGroup ? participantUids.length : undefined,
        lastMessage: text,
        lastAt: at,
        unread: isUnread ? 1 : 0,
        careAlert: (p as any).careAlert,
      });
    } else {
      if (isUnread) existing.unread += 1;
      if (partnerPersonName) existing.partnerPersonName = partnerPersonName;
      if (at >= existing.lastAt) {
        existing.lastAt = at;
        existing.lastMessage = text;
        existing.careAlert = (p as any).careAlert; // newest message wins → alert auto-clears
        if (p.threadId) existing.threadId = p.threadId;
        if (isGroup) existing.participantCount = participantUids.length;
      }
      if (!existing.partnerPhoto && partnerPhoto) existing.partnerPhoto = partnerPhoto;
    }
  }
  return Array.from(map.values()).sort((a, b) => b.lastAt - a.lastAt);
}

// A group thread chosen from the inbox — carries enough to open it and reply within it.
export interface GroupThreadDescriptor {
  threadId: string;
  partnerId: string;          // the subject tree the circle is about
  partnerName: string;        // display name, e.g. "Oak · Guardians"
  partnerPhoto?: string;
  audience?: ReachAudience;
  participantCount?: number;
}

// One rendered line of a conversation. `authorId`/`authorName` let group threads show who
// spoke; 1:1 and Oracle threads leave them unset and render as a plain two-party chat.
export interface ThreadLine {
  role: 'user' | 'model';
  text: string;
  id?: string;         // the underlying reach pulse id, so a message can be liked
  loveCount?: number;  // likes on that pulse
  authorId?: string;
  authorName?: string;
  authorPersonName?: string;
  authorPhoto?: string;
  system?: boolean; // a centered notice (e.g. "X minted this conversation to the chain"), not a bubble
  careAlert?: 'watering'; // a "water me" alert — rendered with a blue border
  retracted?: boolean;    // the author withdrew it: the mark shows, the words do not
}
type ChatMessage = ThreadLine;

// Raw reach pulses → the rendered conversation, oldest first as given. A pulse is MINE when I
// wrote it or it speaks from one of my trees: my words are 'user', the other side's 'model',
// and a stored reply (`reachResponse`) is the opposite voice of its pulse. In a group thread
// every line is attributed. A mint notice is a system line; a retracted line keeps its mark.
export function threadLines(pulses: Pulse[], viewer: { uid?: string; treeIds: string[]; group: boolean }): ThreadLine[] {
  const myUid = viewer.uid;
  const myIds = new Set<string>(viewer.treeIds);
  const group = viewer.group;
    const history: ChatMessage[] = [];
    pulses.forEach(p => {
        const text = p.content || p.body || '';
        // A mint notice is a system line both sides see, not a chat bubble.
        if (p.mintNotice) { if (text) history.push({ role: 'model', system: true, text }); return; }
        const mine = (!!myUid && p.authorId === myUid) || myIds.has(p.lifetreeId || '');
        const careAlert = (p as any).careAlert as ChatMessage['careAlert'];
        const base = { id: p.id, loveCount: p.loveCount || 0, ...((p as { retractedAt?: unknown }).retractedAt ? { retracted: true } : {}), ...(group ? { authorId: p.authorId, authorName: p.authorName, authorPersonName: p.authorPersonName, authorPhoto: p.authorPhoto } : {}), ...(careAlert ? { careAlert } : {}) };
        if (mine) {
            if (text) history.push({ role: 'user', text, ...base });
            if (p.reachResponse) history.push({ role: 'model', text: p.reachResponse });
        } else {
            if (text) history.push({ role: 'model', text, ...base });
            if (p.reachResponse) history.push({ role: 'user', text: p.reachResponse });
        }
    });
    return history;
}

// The reaches addressed to this viewer, by another hand, that they have not yet seen.
export function unseenReachIds(pulses: Pulse[], uid: string): string[] {
  return pulses
    .filter(p => p.authorId !== uid
      && (p.recipientUid === uid || (p.participantUids || []).includes(uid))
      && !(p.seenBy || []).includes(uid))
    .map(p => p.id);
}

// What a loaded group thread remembers of itself, so a reply lands in the same conversation
// with the same participants.
export interface ThreadMeta {
  threadId: string;
  participantUids: string[];
  reachTreeId?: string;
  reachTreeName?: string;
  threadName?: string;
  audience?: ReachAudience;
}
