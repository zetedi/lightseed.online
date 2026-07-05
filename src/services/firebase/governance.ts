import { query, getDocs, addDoc, serverTimestamp, doc, runTransaction, where, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { type Pulse, type Community, type Decision, type DecisionNature, votesRequired } from '../../types';
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
    data: { nature: DecisionNature; title: string; body?: string; subject?: string; proposedBy: string },
): Promise<Decision> => {
    const required = votesRequired(data.nature);
    const votes = [data.proposedBy]; // the proposer's voice is the first vote
    const passed = votes.length >= required;
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
        votes,
        votesRequired: required,
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
        const concerns = (Array.isArray(d.concerns) ? d.concerns : []).filter((c: any) => c.by !== actor);
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
export const createEvent = async (data: any) => {
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

export const createCommunityEvent = async (community: Community, data: any) => {
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
