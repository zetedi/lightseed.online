import { query, getDocs, addDoc, serverTimestamp, doc, runTransaction, where, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { type Pulse, type Community, type Decision, type DecisionNature, type DecisionMode, type ConsensusStance, votesRequired } from '../../types';
import { createBlock } from '../../utils/crypto';
import { uuidv7 } from '../../utils/id';
import { type PulseVisibility } from '../../domain/pulse';
import { auth, db, toMillis, mapDoc, pulsesCollection } from './core';
import { normalizeDomain } from './trees';

// ---------------------------------------------------------------------------
// Governance — an event that is a decision. Its NATURE sets the votes it needs.
// Decisions are NOT a separate collection: they are pulses (type 'decision') on the one
// immutable ledger, exactly as community events are. Pulse, event, decision — one chain.
// ---------------------------------------------------------------------------

export const createDecision = async (
    community: Pick<Community, 'id' | 'domain'>,
    data: { nature: DecisionNature; title: string; body?: string; subject?: string; proposedBy: string; mode?: DecisionMode },
): Promise<Decision> => {
    const mode: DecisionMode = data.mode || 'threshold';
    const required = votesRequired(data.nature);
    const votes = [data.proposedBy]; // the proposer's voice is the first vote
    // Threshold can pass on creation (e.g. a 1-voice intention); consensus never does — the clerk
    // must discern the sense of the meeting, so it always opens.
    const passed = mode === 'threshold' && votes.length >= required;
    const payload = {
        type: 'decision',
        communityId: community.id,
        domain: normalizeDomain(community.domain),
        visibility: 'public' as PulseVisibility, // governance is transparent — decisions stay public
        nature: data.nature,
        title: data.title,
        body: data.body || '',
        subject: data.subject || '',
        authorId: data.proposedBy, // unified with pulses' author field
        proposedBy: data.proposedBy,
        mode,
        votes,
        votesRequired: required,
        positions: [] as any[],
        status: passed ? 'passed' as const : 'open' as const,
    };
    const hash = await createBlock('DECISION', payload, Date.now());
    const lid = uuidv7();
    const ref = await addDoc(pulsesCollection, {
        ...payload,
        lid,
        previousHash: 'DECISION',
        hash,
        ...(passed ? { passedAt: serverTimestamp() } : {}),
        createdAt: serverTimestamp(),
    });
    return { id: ref.id, lid, ...payload, previousHash: 'DECISION', hash } as unknown as Decision;
};

// Add a voice. When the circle reaches the threshold, the decision passes and an enactment
// block is written to the chain. Transactional so two votes can't race past it. A decision that
// is closed (passed/withdrawn/rejected/expired) or in `listening` (a concern was raised) does
// not accept votes until it is resumed.
export type VoteOutcome = 'passed' | 'open' | 'already' | 'listening' | 'closed';
export const voteOnDecision = async (decisionId: string, uid: string): Promise<VoteOutcome> => {
    const actor = auth.currentUser?.uid || uid; // record the authenticated voice, not a client-supplied id
    const ref = doc(db, 'pulses', decisionId);
    return runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new Error('Decision not found.');
        const d = snap.data() as any;
        if (d.status === 'passed') return 'passed' as const;
        if (['withdrawn', 'rejected', 'expired'].includes(d.status)) return 'closed' as const;
        if (d.listening) return 'listening' as const; // paused for reflection until the concern is tended
        const votes: string[] = Array.isArray(d.votes) ? d.votes : [];
        if (votes.includes(actor)) return 'already' as const;
        const next = [...votes, actor];
        const required = d.votesRequired ?? votesRequired(d.nature);
        if (next.length >= required) {
            const enactedHash = await createBlock(d.hash || 'DECISION', { decision: decisionId, votes: next, enacted: true }, Date.now());
            tx.update(ref, { votes: next, status: 'passed', passedAt: serverTimestamp(), enactedHash });
            return 'passed' as const;
        }
        tx.update(ref, { votes: next });
        return 'open' as const;
    });
};

// Raise a concern (a veto that opens reflection, not just a halt). Records the concern and puts
// the decision into `listening` — a visible, reflective pause ("A concern was raised. This
// proposal has entered listening.") that stops it passing until the concern is tended.
export const raiseConcern = async (decisionId: string, uid: string, note?: string): Promise<'listening' | 'closed'> => {
    const actor = auth.currentUser?.uid || uid;
    const ref = doc(db, 'pulses', decisionId);
    return runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new Error('Decision not found.');
        const d = snap.data() as any;
        if (['passed', 'withdrawn', 'rejected', 'expired'].includes(d.status)) return 'closed' as const;
        // One concern per voice (a re-raise replaces it) — bounds the array, no spam. And
        // serverTimestamp() can't live inside an array element, so stamp the concern client-side.
        const concerns = (Array.isArray(d.concerns) ? d.concerns : []).filter((c: { by: string }) => c.by !== actor);
        tx.update(ref, { listening: true, concerns: [...concerns, { by: actor, note: note || '', at: Timestamp.fromMillis(Date.now()) }] });
        return 'listening' as const;
    });
};

// Tend the concern: lift the listening pause so the circle can continue. (Concerns are kept.)
export const resumeDecision = (decisionId: string) =>
    updateDoc(doc(db, 'pulses', decisionId), { listening: false });

// The proposer (or staff) withdraws their proposal.
export const withdrawDecision = (decisionId: string) =>
    updateDoc(doc(db, 'pulses', decisionId), { status: 'withdrawn', listening: false, withdrawnAt: serverTimestamp() });

// Close a proposal as not adopted.
export const rejectDecision = (decisionId: string) =>
    updateDoc(doc(db, 'pulses', decisionId), { status: 'rejected', listening: false, rejectedAt: serverTimestamp() });

// --- Quaker consensus -----------------------------------------------------------------------
// Record a voice's position in a consensus meeting: unite, stand aside, or block. One per person
// (a new position replaces the old). Blocked-ness is derived from positions in the view, so this
// never touches `status` — it stays within what any signed-in member may write. A closed decision
// takes no more positions. Timestamps are client-stamped (serverTimestamp can't live in an array).
export const recordPosition = async (decisionId: string, uid: string, stance: ConsensusStance, note?: string): Promise<'ok' | 'closed'> => {
    const actor = auth.currentUser?.uid || uid;
    const ref = doc(db, 'pulses', decisionId);
    return runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new Error('Proposal not found.');
        const d = snap.data() as any;
        if (['passed', 'withdrawn', 'rejected', 'expired'].includes(d.status)) return 'closed' as const;
        const positions = (Array.isArray(d.positions) ? d.positions : []).filter((p: { by: string }) => p.by !== actor);
        positions.push({ by: actor, stance, note: note || '', at: Timestamp.fromMillis(Date.now()) });
        tx.update(ref, { positions });
        return 'ok' as const;
    });
};

// The clerk discerns the sense of the meeting. Uniting (passing) requires that NO block stands;
// a clerk may also record that the meeting did not reach unity ('rejected'). Clerk = proposer /
// community owner / staff (enforced by the pulse-update rule's status gate).
export const discernDecision = async (decisionId: string, outcome: 'passed' | 'rejected'): Promise<'passed' | 'rejected'> => {
    const ref = doc(db, 'pulses', decisionId);
    return runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new Error('Proposal not found.');
        const d = snap.data() as any;
        if (['passed', 'withdrawn', 'rejected', 'expired'].includes(d.status)) throw new Error('This proposal is already settled.');
        if (outcome === 'passed') {
            const blocks = (Array.isArray(d.positions) ? d.positions : []).filter((p: { stance: string }) => p.stance === 'block');
            if (blocks.length) throw new Error('A block still stands — the meeting is not in unity. Tend the block first.');
            const enactedHash = await createBlock(d.hash || 'DECISION', { decision: decisionId, united: true }, Date.now());
            tx.update(ref, { status: 'passed', passedAt: serverTimestamp(), enactedHash });
            return 'passed' as const;
        }
        tx.update(ref, { status: 'rejected', rejectedAt: serverTimestamp() });
        return 'rejected' as const;
    });
};

export const getDecisions = async (communityId: string, levels?: PulseVisibility[]): Promise<Decision[]> => {
    const base = where('communityId', '==', communityId);
    // Governance is a council concern: a viewer only queries decisions at visibility levels the
    // rules allow them (a signed-out viewer → ['public']), so private/community-scoped decisions
    // never reach an outsider. Mirrors getCommunityEvents; needs the (communityId, visibility) index.
    const q = levels && levels.length
        ? query(pulsesCollection, base, where('visibility', 'in', levels))
        : query(pulsesCollection, base);
    const snap = await getDocs(q);
    return snap.docs
        .map(d => (mapDoc(d) as Decision))
        .filter(p => (p as any).type === 'decision')
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
};

export const deleteCommunityEvent = (eventId: string) => deleteDoc(doc(db, 'pulses', eventId));

// Edit an event's content fields. The chain hash / lid / author stay immutable — only the
// editable fields are written, and author is never overwritten so an admin editing someone
// else's event doesn't steal authorship. Edit authorization is enforced app-side via
// canEditEvent (creator / community admin / node owner), matching the trusted-cohort posture.
export const updateEvent = async (
    eventId: string,
    data: Partial<Pick<Pulse, 'title' | 'body' | 'content' | 'imageUrl' | 'imageUrls' | 'eventDate' | 'eventLocation' | 'visibility'>>,
) => {
    await updateDoc(doc(db, 'pulses', eventId), { ...data });
};

// A standalone event — anyone can plant one (no community required). A community can later
// form around it. It's a pulse of type 'event' on the one ledger, like community events.
export const createEvent = async (data: Partial<Pulse> & { title: string }) => {
    const domain = normalizeDomain(data.domain || (typeof window !== 'undefined' ? window.location.hostname : ''));
    const eventPayload = { ...data, type: 'event', domain, visibility: data.visibility || 'public' };
    const hash = await createBlock('EVENT', eventPayload, Date.now());
    const lid = uuidv7();
    const ref = await addDoc(pulsesCollection, {
        ...eventPayload,
        lid,
        loveCount: 0,
        commentCount: 0,
        previousHash: 'EVENT',
        hash,
        createdAt: serverTimestamp(),
    });
    return { id: ref.id, lid, ...eventPayload, loveCount: 0, commentCount: 0, previousHash: 'EVENT', hash } as Pulse;
};

export const createCommunityEvent = async (community: Community, data: Partial<Pulse> & { title: string }) => {
    const eventPayload = {
        ...data,
        type: 'event',
        domain: normalizeDomain(community.domain),
        communityId: community.id,
        communityName: community.name,
        visibility: data.visibility || 'public',
    };
    const hash = await createBlock('COMMUNITY_EVENT', eventPayload, Date.now());
    const lid = uuidv7();
    const eventRef = await addDoc(pulsesCollection, {
        ...eventPayload,
        lid,
        loveCount: 0,
        commentCount: 0,
        previousHash: 'COMMUNITY_EVENT',
        hash,
        createdAt: serverTimestamp(),
    });
    return { id: eventRef.id, lid, ...eventPayload, loveCount: 0, commentCount: 0, previousHash: 'COMMUNITY_EVENT', hash } as Pulse;
};
