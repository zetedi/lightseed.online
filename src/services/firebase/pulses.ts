import { collection, query, orderBy, getDocs, serverTimestamp, doc, runTransaction, getDoc, where, updateDoc, limit, startAfter, QueryDocumentSnapshot, arrayUnion, onSnapshot, getCountFromServer } from 'firebase/firestore';
import { type Pulse, type Lifetree, type ReachAudience } from '../../types';
import { createBlock } from '../../utils/crypto';
import { computeCanonicalHash, isChainLocked, BLOCK_HASH_VERSION } from '../../domain/chain';
import { normalizePulseType, isTreeGrowth, type PulseVisibility } from '../../domain/pulse';
import { isExplicitlyValidatedTree } from '../../utils/validation';
import { buildThreadId, buildGroupThreadId, reachAudienceLabels } from '../../utils/reachPermissions';
import { db, toMillis, mapDoc, mapPulse, pulsesCollection } from './core';
import { isHubDomain } from './trees';

const fetchPulsesRaw = async (lastD?: QueryDocumentSnapshot, domainFilter?: string, levels?: PulseVisibility[], pageSize?: number) => {
    // Visibility-scope the broad feed so a restricted pulse in this domain can't get the
    // whole query rejected. Broad feeds carry no scope context, so `levels` is public + node.
    const visFilter = levels && levels.length ? [where('visibility', 'in', levels)] : [];
    const nonHub = !!(domainFilter && !isHubDomain(domainFilter));
    const lim = pageSize ?? (nonHub ? 24 : 12);
    let q;
    if (nonHub) {
        q = query(pulsesCollection, where('domain', '==', domainFilter!.replace(/^www\./, '')), ...visFilter, limit(lim));
    } else {
        q = query(pulsesCollection, ...visFilter, orderBy('createdAt', 'desc'), limit(lim));
    }

    if (lastD) q = query(q, startAfter(lastD));
    const snap = await getDocs(q);
    let items = snap.docs.map(mapPulse);

    if (domainFilter && !isHubDomain(domainFilter)) {
        items = items.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
    }

    return { items, lastDoc: snap.docs[snap.docs.length-1] || null };
}

// The main Pulses feed shows offerings, dreams and other content pulses.
// Reaches live in the Inspiration view, so they are excluded here.
// Pulse types that have their own surfaces and must not bleed into the general pulse feed.
const NON_FEED_PULSE_TYPES = new Set(['reach', 'tree_chat', 'event', 'decision']);

// The number of feed pulses a user has authored — server-side COUNTs instead of downloading every
// doc just to measure length. Excludes the same non-feed types as getMyPulses; computed as
// (all authored) − (each non-feed type) so it only needs the existing indexes — a `not-in` count
// would require a composite (authorId, type) index that isn't defined.
export const getMyPulseCount = async (uid: string): Promise<number> => {
    const [total, ...nonFeed] = await Promise.all([
        getCountFromServer(query(pulsesCollection, where('authorId', '==', uid))),
        ...Array.from(NON_FEED_PULSE_TYPES).map(type =>
            getCountFromServer(query(pulsesCollection, where('authorId', '==', uid), where('type', '==', type)))),
    ]);
    const excluded = nonFeed.reduce((n, s) => n + s.data().count, 0);
    return Math.max(0, total.data().count - excluded);
};

export const fetchPulses = async (lastD?: QueryDocumentSnapshot, domainFilter?: string, levels?: PulseVisibility[]) => {
    const res = await fetchPulsesRaw(lastD, domainFilter, levels);
    return {
        items: res.items.filter(pulse => !NON_FEED_PULSE_TYPES.has((pulse as any).type)),
        lastDoc: res.lastDoc
    };
}

export const fetchEventPulses = async (lastD?: QueryDocumentSnapshot, domainFilter?: string, levels?: PulseVisibility[]) => {
    // Events are sparse among recent pulses, so the shared feed's small page buries them under the
    // newest reaches/growths and drops them. Widen the window (still one indexed read) so events
    // actually surface. (A dedicated (type, createdAt) index would let this filter server-side.)
    const res = await fetchPulsesRaw(lastD, domainFilter, levels, 80);
    return {
        items: res.items.filter(pulse => pulse.type === 'event'),
        lastDoc: res.lastDoc
    };
};

// Reaches (and legacy 'tree_chat' pulses) power the Inspiration threads.
const isReachPulse = (p: Pulse) => p.type === 'reach' || (p as any).type === 'tree_chat';

// The open Inspiration feed. `levels` (public + node + the viewer's qualifying scopes) keeps
// the query to docs the rules allow — without it the visibility-filter is dropped and a single
// private reach in range would reject the whole query. Only PUBLIC reach reflections (minted
// "Mint Wisdom" pulses) belong here; private DMs and group threads carry participantUids /
// recipientUid and are filtered out, so a direct message never surfaces in this public feed.
export const fetchReachPulses = async (lastD?: QueryDocumentSnapshot, domainFilter?: string, levels?: PulseVisibility[]) => {
    const res = await fetchPulsesRaw(lastD, domainFilter, levels);
    return {
        items: res.items.filter(p =>
            isReachPulse(p)
            && (p.visibility || 'public') === 'public'
            && !p.participantUids
            && !p.recipientUid),
        lastDoc: res.lastDoc
    };
};


// Load my 1:1 conversation with a partner tree's owner, oldest first.
//
// PRIVACY: we query ONLY documents the viewer is allowed to read under the hardened
// rules — reaches I authored to the partner, and reaches addressed to me from the
// partner. A query that matched a reach I cannot read (e.g. the partner's messages with
// someone else) would be rejected wholesale by Firestore, so the old "fetch everything
// touching the tree, then filter" approach is both a leak AND rule-incompatible. Group
// reaches (isGroup) are excluded here — those open by threadId via fetchThreadById.
export const fetchReachThread = async (
    partnerId: string,
    viewer: { uid?: string | null; treeIds?: string[] },
) => {
    const myUid = viewer.uid || undefined;
    if (!myUid) return [];
    const [outgoing, incoming, legacy] = await Promise.all([
        getDocs(query(pulsesCollection, where('authorId', '==', myUid), where('reachTreeId', '==', partnerId))),
        getDocs(query(pulsesCollection, where('recipientUid', '==', myUid), where('lifetreeId', '==', partnerId))),
        // Legacy 'tree_chat' pulses (no recipientUid) stayed world-readable; keep showing them.
        getDocs(query(pulsesCollection, where('chatTreeId', '==', partnerId))),
    ]);
    const byId = new Map<string, Pulse>();
    [...outgoing.docs, ...incoming.docs, ...legacy.docs].forEach(d => {
        const p = mapDoc(d) as Pulse;
        if (isReachPulse(p) && !p.isGroup) byId.set(p.id, p);
    });
    return Array.from(byId.values()).sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt));
};

// Load every message in one thread (1:1 or group) by its threadId, oldest first. Used to
// open a thread chosen from the inbox. The rules confine reach reads to participants, so a
// returned thread is only ever one the viewer belongs to.
export const fetchThreadById = async (threadId: string) => {
    if (!threadId) return [];
    const snap = await getDocs(query(pulsesCollection, where('threadId', '==', threadId)));
    return snap.docs
        .map(d => (mapDoc(d) as Pulse))
        .filter(isReachPulse)
        .sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt));
};

// All reaches involving me, newest first — my personal Inspiration inbox. Three single-field
// queries, merged: ones I authored, classic 1:1 ones addressed to me (recipientUid), and any
// thread (1:1 or group) I'm a participant of. The participantUids branch is what surfaces
// group threads where I'm a recipient but not the author.
export const fetchMyReaches = async (uid: string) => {
    const [authored, received, partOf] = await Promise.all([
        getDocs(query(pulsesCollection, where('authorId', '==', uid))),
        getDocs(query(pulsesCollection, where('recipientUid', '==', uid))),
        getDocs(query(pulsesCollection, where('participantUids', 'array-contains', uid))),
    ]);
    const byId = new Map<string, Pulse>();
    [...authored.docs, ...received.docs, ...partOf.docs].forEach(d => {
        const p = mapDoc(d) as Pulse;
        if (isReachPulse(p)) byId.set(p.id, p);
    });
    const items = Array.from(byId.values()).sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
    return { items, lastDoc: null };
};

// Live stream of every thread I'm a participant of (1:1 and group), for the unread (green
// glow) indicator. participantUids array-contains me covers reaches addressed to me in both
// kinds of thread; single-field array index (no composite). Filtered to reaches client-side.
export const listenToMyReaches = (uid: string, callback: (pulses: Pulse[]) => void) =>
    onSnapshot(query(pulsesCollection, where('participantUids', 'array-contains', uid)), (snap) => {
        callback(snap.docs.map(d => (mapDoc(d) as Pulse)).filter(isReachPulse));
    });

// Live stream of reaches addressed to any of my trees. Belt-and-braces alongside
// listenToMyReaches: catches incoming reaches even when a legacy/edge send did not
// capture recipientUid, so the recipient still gets notified. Firestore 'in' caps at 10.
export const listenToReachesForTrees = (treeIds: string[], callback: (pulses: Pulse[]) => void) => {
    const ids = treeIds.filter(Boolean).slice(0, 10);
    if (ids.length === 0) { callback([]); return () => {}; }
    return onSnapshot(query(pulsesCollection, where('reachTreeId', 'in', ids)), (snap) => {
        callback(snap.docs.map(d => (mapDoc(d) as Pulse)).filter(isReachPulse));
    });
};

export const markReachesSeen = async (pulseIds: string[], uid: string) => {
    await Promise.all(pulseIds.map(id =>
        updateDoc(doc(db, 'pulses', id), { seenBy: arrayUnion(uid) }).catch(() => {})
    ));
};

// Public alias — batch-mark reach pulses as seen by a user (seenBy arrayUnion).
export const markReachPulsesSeen = markReachesSeen;

// Send a reach from one tree to another — either a 1:1 message to the target's owner
// (audience omitted) or a group message to a slice of the target's circle (audience
// 'owners' | 'guardians' | 'everyone'), which lands in a shared, multi-person thread.
//
// Every reach is written with `participantUids` and `visibility: 'private'` so the
// Firestore rules can confine reads to the people in the thread (see canReadPulse).
//
// The privacy gate is enforced here as well as in the UI: a "protected" target
// (owner has onlyValidatedCanReach) only accepts reaches from the owner themselves,
// an admin/super admin, or a sender whose active tree is explicitly validated.
//
// TODO(security): Firestore security rules cannot cheaply cross-read the target's
// privacy flag at write time, so this rule is enforced in the service + UI layers.
// The target's onlyValidatedCanReach is mirrored onto its (world-readable) tree doc,
// which we read here to evaluate the gate without weakening the rules.
// Resolve the user ids a group reach should reach, from the LIN links collection — the single
// source of truth (also what the Firestore rules check). The owner is always in their own
// circle. Audiences nest: owners ⊂ guardians ⊂ everyone. We deliberately do NOT read the legacy
// role arrays: writes are links-only now, so a stale array could otherwise re-include someone
// who was unlinked. (One-time legacy data is covered by migrateArraysToLinks.)
export const resolveCircleUids = async (tree: Lifetree, audience: ReachAudience): Promise<string[]> => {
    const owner = tree.ownerId ? [tree.ownerId] : [];
    const byRel: Record<string, string[]> = { co_owner: [], guardian: [], steward: [], observer: [] };
    try {
        const links = await getDocs(query(collection(db, 'links'), where('to', '==', tree.id)));
        links.docs.forEach(d => { const x = d.data() as any; if (byRel[x.rel]) byRel[x.rel].push(x.from); });
    } catch (e) { console.warn('resolveCircleUids: link read failed', e); }
    const ids =
        audience === 'owners' ? [...owner, ...byRel.co_owner]
        : audience === 'guardians' ? [...owner, ...byRel.co_owner, ...byRel.guardian]
        : [...owner, ...byRel.co_owner, ...byRel.guardian, ...byRel.steward, ...byRel.observer];
    return Array.from(new Set(ids.filter(Boolean)));
};

export const sendReach = async ({
    fromTree,
    toTree,
    text,
    sender,
    audience,
    mintNotice = false,
    isAdmin = false,
    isSuperAdmin = false,
}: {
    fromTree: Lifetree;
    toTree: Lifetree;
    text: string;
    sender: { uid: string; displayName?: string | null; photoURL?: string | null };
    audience?: ReachAudience; // omitted/undefined = classic 1:1 reach to the owner
    mintNotice?: boolean;     // system line announcing the conversation was minted to the chain
    isAdmin?: boolean;
    isSuperAdmin?: boolean;
}) => {
    // A group reach needs the target's full circle (co-owners / guardians / …), so always
    // resolve the freshest target when an audience is set; otherwise resolve only if the
    // lightweight tree object is missing its owner + privacy flag.
    let target = toTree;
    if (audience || !target.ownerId) {
        const full = await getLifetreeById(toTree.id);
        if (full) target = full;
    }
    const ownerUid = target.ownerId || null;

    const protectedTarget = target.onlyValidatedCanReach === true;
    const isSelf = !!ownerUid && ownerUid === sender.uid;
    if (protectedTarget && !isSelf && !isAdmin && !isSuperAdmin && !isExplicitlyValidatedTree(fromTree)) {
        throw new Error('This Lifetree only accepts direct messages from validated trees.');
    }

    const base = {
        lifetreeId: fromTree.id,
        type: 'reach' as const,
        body: text,
        content: text,
        reachTreeId: target.id,
        reachTreeName: target.name,
        recipientName: target.name,
        seenBy: [],
        visibility: 'private' as const,
        ...(mintNotice ? { mintNotice: true } : {}),
        authorId: sender.uid,
        authorName: fromTree.name,
        authorPersonName: sender.displayName || undefined,
        authorPhoto: fromTree.imageUrl || sender.photoURL || undefined,
    };

    if (audience) {
        // Group reach to the tree's circle — one shared thread keyed by (tree, audience, me).
        // resolveCircleUids reads the LIN links (single source of truth) so every circle member
        // is reached however they were added (the guardian-split fix).
        const circle = await resolveCircleUids(target, audience);
        const participantUids = Array.from(new Set([sender.uid, ...circle].filter(Boolean)));
        if (participantUids.length <= 1) {
            throw new Error('There is no one in that circle to reach yet.');
        }
        return mintPulse({
            ...base,
            title: `Reach: ${fromTree.name} -> ${target.name} (${reachAudienceLabels[audience]})`,
            recipientUid: null,
            participantUids,
            threadId: buildGroupThreadId(target.id, audience, sender.uid),
            threadName: `${target.name} · ${reachAudienceLabels[audience]}`,
            audience,
            isGroup: true,
        });
    }

    // Classic 1:1 reach to the target's owner.
    const participantUids = Array.from(new Set([sender.uid, ownerUid].filter(Boolean) as string[]));
    return mintPulse({
        ...base,
        title: `Reach: ${fromTree.name} -> ${target.name}`,
        recipientUid: ownerUid,
        participantUids,
        threadId: buildThreadId(fromTree.id, target.id),
    });
};

// Reply within an EXISTING thread (group or 1:1), reusing its threadId + participantUids so
// everyone stays in the same shared conversation. Unlike sendReach it never re-derives the
// thread, so a guardian replying lands in the initiator's group thread instead of spawning a
// new per-initiator one. Used when a thread was opened from the inbox.
export const sendThreadMessage = async ({
    thread,
    fromTree,
    sender,
    text,
    mintNotice = false,
}: {
    thread: {
        threadId: string;
        participantUids: string[];
        reachTreeId?: string;
        reachTreeName?: string;
        threadName?: string;
        audience?: ReachAudience;
        isGroup?: boolean;
    };
    fromTree: Lifetree;
    sender: { uid: string; displayName?: string | null; photoURL?: string | null };
    text: string;
    mintNotice?: boolean;
}) => {
    const participantUids = Array.from(new Set([sender.uid, ...(thread.participantUids || [])].filter(Boolean)));
    const isGroup = thread.isGroup ?? participantUids.length > 2;
    return mintPulse({
        lifetreeId: fromTree.id,
        type: 'reach',
        title: `Reach: ${fromTree.name} -> ${thread.threadName || thread.reachTreeName || 'thread'}`,
        body: text,
        content: text,
        reachTreeId: thread.reachTreeId,
        reachTreeName: thread.reachTreeName,
        // 1:1 keeps a single recipientUid (the other party); a group routes by participantUids.
        recipientUid: isGroup ? null : (participantUids.find(u => u !== sender.uid) || null),
        recipientName: thread.reachTreeName,
        participantUids,
        threadId: thread.threadId,
        threadName: thread.threadName,
        audience: thread.audience,
        isGroup,
        ...(mintNotice ? { mintNotice: true } : {}),
        seenBy: [],
        visibility: 'private',
        authorId: sender.uid,
        authorName: fromTree.name,
        authorPersonName: sender.displayName || undefined,
        authorPhoto: fromTree.imageUrl || sender.photoURL || undefined,
    });
};

export const getLifetreeById = async (id: string): Promise<Lifetree | null> => {
    const snap = await getDoc(doc(db, 'lifetrees', id));
    return snap.exists() ? ({ id: snap.id, ...(snap.data() as any) } as Lifetree) : null;
};

// A single pulse by id (used to hydrate alignment cards with the two matched pulses' text).
export const getPulseById = async (id: string): Promise<Pulse | null> => {
    const snap = await getDoc(doc(db, 'pulses', id));
    return snap.exists() ? mapPulse(snap) : null;
};

export const getMyPulses = async (uid: string) => (await getDocs(query(pulsesCollection, where('authorId', '==', uid)))).docs.map(mapPulse).filter(p => !NON_FEED_PULSE_TYPES.has((p as any).type)).sort((a,b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
// Tree growth pulses — canonical 'tree_growth' plus legacy 'GROWTH' (until migration runs). Old
// VISION growths ('growth'/'vision_growth') are deliberately excluded, so there is no transition
// window where they leak into a tree's growth timeline.
export const fetchGrowthPulses = async (treeId: string) => (await getDocs(query(pulsesCollection, where('lifetreeId', '==', treeId), where('type', 'in', ['tree_growth', 'GROWTH'])))).docs.map(mapPulse).sort((a,b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));

export const getPulsesByTreeId = async (treeId: string) => {
    // Exclude reaches/tree_chat: they are private DMs minted onto the sender tree's chain, so
    // a tree's public timeline must never surface them — and (since they are now readable only
    // by their participants) a broad lifetreeId query that returned one would be rejected by the
    // rules for any other viewer, breaking the whole tree page. Needs the (lifetreeId, type) index.
    const q = query(pulsesCollection, where('lifetreeId', '==', treeId), where('type', 'not-in', ['reach', 'tree_chat']));
    const snap = await getDocs(q);
    const pulses = snap.docs.map(mapPulse);
    // Sort Descending (Newest -> Oldest/Genesis) so the timeline can be rendered top-down
    return pulses.sort((a,b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
}

// `extraTreeUpdate` lets a caller fold additional tree-doc fields (dotted paths allowed) into
// the SAME transaction that appends the block — so e.g. a watering's schedule reset commits
// atomically with its growth pulse (no window where the chain advanced but the tree is stale).
export const mintPulse = async (pulseData: any, extraTreeUpdate?: Record<string, any>) => {
    return runTransaction(db, async (t) => {
        const treeRef = doc(db, 'lifetrees', pulseData.lifetreeId);
        const treeDoc = await t.get(treeRef);
        if (!treeDoc.exists()) throw new Error("Tree missing");
        const tree = treeDoc.data() as Lifetree;
        const newPulseRef = doc(pulsesCollection);
        const domain = tree.domain || window.location.hostname.replace(/^www\./, '');
        const canonicalType = normalizePulseType(pulseData.type); // write canonical lowercase
        // A stable, client-resolved mint time — stored on the block AND used as the hash timestamp,
        // so a locked block can be re-hashed from exactly what's persisted (createdAt is a
        // serverTimestamp and can't be reproduced). Always stored; only hashed when locked.
        const mintedAt = Date.now();
        // The immutable record we persist (server-set createdAt + the hash are added after).
        const record = {
            ...pulseData,
            type: canonicalType,
            domain,
            id: newPulseRef.id,
            visibility: pulseData.visibility || 'public',
            loveCount: pulseData.loveCount || 0,
            commentCount: pulseData.commentCount || 0,
            mintedAt,
            previousHash: tree.latestHash,
        };
        // Locked nodes seal blocks with the canonical, reproducible hash over the stored record;
        // unlocked nodes keep the exact legacy hash so existing chains are untouched until the
        // node flips the stamp. (See src/domain/chain + isChainLocked.)
        const locked = isChainLocked();
        const newHash = locked
            ? await computeCanonicalHash(tree.latestHash, mintedAt, record)
            : await createBlock(tree.latestHash, pulseData, mintedAt);
        // Mark canonically-sealed blocks so verification can recompute exactly these (legacy blocks
        // predate the scheme). hashVersion is metadata — not in BLOCK_CONTENT_FIELDS, so it doesn't
        // enter the hash.
        t.set(newPulseRef, { ...record, ...(locked ? { hashVersion: BLOCK_HASH_VERSION } : {}), createdAt: serverTimestamp(), hash: newHash });

        const updateData: any = { latestHash: newHash, blockHeight: (tree.blockHeight || 0) + 1 };
        // A tree growth pulse with an image updates the tree's latest growth view, and counts
        // as a tend that keeps the tree's living validation alive.
        if (isTreeGrowth(canonicalType)) {
            if (pulseData.imageUrl) updateData.latestGrowthUrl = pulseData.imageUrl;
            updateData.lastTendedAt = serverTimestamp();
        }
        // Caller-supplied tree fields (e.g. a watering's schedule reset) — committed atomically.
        if (extraTreeUpdate) Object.assign(updateData, extraTreeUpdate);

        t.update(treeRef, updateData);
    });
}

// An explicit tend — the lightweight "it still lives" confirmation. Writes a small TEND
// block onto the tree's own chain and refreshes its validation liveness.
export const tendTree = async (tree: Pick<Lifetree, 'id' | 'latestHash' | 'genesisHash' | 'blockHeight'>): Promise<void> => {
    const prev = tree.latestHash || tree.genesisHash || '0';
    const newHash = await createBlock(prev, { tend: true }, Date.now());
    await updateDoc(doc(db, 'lifetrees', tree.id), {
        lastTendedAt: serverTimestamp(),
        latestHash: newHash,
        blockHeight: (tree.blockHeight || 0) + 1,
        updatedAt: serverTimestamp(),
    });
};

