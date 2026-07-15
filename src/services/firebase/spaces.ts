import { collection, query, orderBy, getDocs, addDoc, serverTimestamp, doc, setDoc, runTransaction, getDoc, where, updateDoc, deleteDoc, limit, startAfter, QueryDocumentSnapshot, writeBatch, deleteField, getCountFromServer, Timestamp, type CollectionReference, type DocumentData } from 'firebase/firestore';
import { type Pulse, type Vision, type Community, type Being, type CommunityInvite } from '../../types';
import { uuidv7 } from '../../utils/id';
import { type PulseVisibility } from '../../domain/pulse';
import { db, toMillis, mapDoc, lifetreesCollection, visionsCollection, pulsesCollection, communitiesCollection, sanctuariesCollection, communityInvitesCollection } from './core';
import { firestoreStore } from '../../adapters/firestore';
import { isHubDomain } from './trees';

export const fetchVisions = async (lastD?: QueryDocumentSnapshot, domainFilter?: string) => {
    let q;
    if (domainFilter && !isHubDomain(domainFilter)) {
        q = query(visionsCollection, where('domain', '==', domainFilter.replace(/^www\./, '')), limit(24));
    } else {
        q = query(visionsCollection, orderBy('createdAt', 'desc'), limit(12));
    }
    
    if (lastD) q = query(q, startAfter(lastD));
    const snap = await getDocs(q);
    let items = snap.docs.map(d => (mapDoc(d) as Vision));
    
    if (domainFilter && !isHubDomain(domainFilter)) {
        items = items.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
    }

    return { items, lastDoc: snap.docs[snap.docs.length-1] || null };
}

export const getMyVisions = async (uid: string) => (await getDocs(query(visionsCollection, where('authorId', '==', uid)))).docs.map(d => (mapDoc(d) as Vision));
// Count of a user's visions — a server-side COUNT for the dashboard stat (one read, no download).
export const getMyVisionCount = async (uid: string): Promise<number> =>
    (await getCountFromServer(query(visionsCollection, where('authorId', '==', uid)))).data().count;
// Visions a user joined — a prism over their outgoing 'joined' links (the LIN), then hydrate.
export const getJoinedVisions = async (uid: string): Promise<Vision[]> => {
    const links = await getDocs(query(collection(db, 'links'), where('from', '==', uid), where('rel', '==', 'joined')));
    const ids = links.docs.map(d => (d.data() as any).to as string);
    const visions = await Promise.all(ids.map(async id => {
        const snap = await getDoc(doc(db, 'visions', id));
        return snap.exists() ? ({ id: snap.id, ...(snap.data() as any) } as Vision) : null;
    }));
    return visions.filter((v): v is Vision => v !== null);
};

export const createVision = async (data: Partial<Vision> & { authorId: string; title: string }) => {
    const domain = (data.domain || window.location.hostname).replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '').trim().toLowerCase();
    // Ground the vision to a community when its domain matches one (the explicit link to a node).
    let communityId = data.communityId;
    if (!communityId && domain) {
        try { communityId = (await getCommunityByDomain(domain))?.id; } catch { /* offline / no match */ }
    }
    // Default to public so legacy/unspecified visions stay visible (mirrors tree visibility).
    return addDoc(visionsCollection, {
        ...data, lid: uuidv7(), domain,
        ...(communityId ? { communityId } : {}),
        visibility: data.visibility || 'public', createdAt: serverTimestamp(),
    });
};
export const deleteVision = (id: string) => deleteDoc(doc(db, 'visions', id));

// Communities
export const fetchCommunities = async () => {
    const snap = await getDocs(query(communitiesCollection, orderBy('createdAt', 'desc')));
    return snap.docs.map(d => (mapDoc(d) as Community));
}

export const getCommunityByDomain = async (domain: string): Promise<Community | null> => {
    const normalized = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    const q = query(communitiesCollection, where('domain', '==', normalized), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() } as Community;
};

export const getCommunityById = async (id: string): Promise<Community | null> => {
    const snap = await getDoc(doc(db, 'communities', id));
    return snap.exists() ? ({ id: snap.id, ...snap.data() } as Community) : null;
};

export const getMyCommunities = async (uid: string) => 
    (await getDocs(query(communitiesCollection, where('ownerId', '==', uid)))).docs.map(d => (mapDoc(d) as Community));

export const COMMUNITY_INVITE_ALLOTMENT = 144;

export const createCommunity = async (data: Partial<Community> & { ownerId: string; name: string; domain: string }) => {
    const lid = uuidv7();
    const docRef = await addDoc(communitiesCollection, {
        ...data,
        lid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });
    // A community manager gets a 144-invite allotment (raise, never lower).
    if (data.ownerId) {
        try {
            await runTransaction(db, async (t) => {
                const uref = doc(db, 'users', data.ownerId);
                const us = await t.get(uref);
                const cur = us.exists() ? (us.data().invitesRemaining || 0) : 0;
                if (cur < COMMUNITY_INVITE_ALLOTMENT) t.update(uref, { invitesRemaining: COMMUNITY_INVITE_ALLOTMENT });
            });
        } catch (e) { console.warn('Could not grant community invite allotment', e); }
    }
    return { id: docRef.id, lid, ...data } as Community;
};

export const updateCommunity = (id: string, data: Partial<Community>) => 
    updateDoc(doc(db, 'communities', id), { ...data, updatedAt: serverTimestamp() });

export const deleteCommunity = (id: string) => deleteDoc(doc(db, 'communities', id));

// ─── The DOOR (domain/communityDoor.ts) — shareable invitations + door-aware joining ────────
// The rules re-verify everything below; these calls only carry the claim.

export const mintCommunityInvite = async (
    communityId: string, createdBy: string, label?: string, expiresAtMs?: number,
): Promise<CommunityInvite> => {
    const expiresAt = expiresAtMs ? Timestamp.fromMillis(expiresAtMs) : null;
    const payload: DocumentData = { communityId, createdBy, createdAt: serverTimestamp() };
    if (label) payload.label = label;
    if (expiresAt) payload.expiresAt = expiresAt;
    const ref = await addDoc(communityInvitesCollection, payload);
    // A complete, honest optimistic copy (the server stamps the true createdAt moments later).
    return { id: ref.id, communityId, createdBy, createdAt: Timestamp.now(), expiresAt, ...(label ? { label } : {}) };
};

export const getCommunityInvite = async (inviteId: string): Promise<CommunityInvite | null> => {
    const snap = await getDoc(doc(db, 'communityInvites', inviteId));
    return snap.exists() ? ({ id: snap.id, ...snap.data() } as CommunityInvite) : null;
};

// Keeper's ledger of a community's invitations, newest first. Sorted client-side so the
// equality query needs no composite index.
export const listCommunityInvites = async (communityId: string): Promise<CommunityInvite[]> =>
    (await getDocs(query(communityInvitesCollection, where('communityId', '==', communityId))))
        .docs.map(d => ({ id: d.id, ...d.data() } as CommunityInvite))
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));

// Revocation is a mark, never a delete — the used invitation IS the provenance record.
export const revokeCommunityInvite = (inviteId: string) =>
    updateDoc(doc(db, 'communityInvites', inviteId), { revokedAt: serverTimestamp() });

// Step in through an OPEN door — the joiner mints their own member link.
export const joinCommunityOpen = (uid: string, communityId: string) =>
    firestoreStore.link(uid, 'member', communityId);

// Arrive holding an invitation: the member edge carries the invite as provenance, and the
// append-only 'invited_by' mark (newcomer → community, inviter recoverable via inviteId)
// records the arrival durably — surviving even if the member later leaves. Admitted only if
// the invitation is real (a keeper minted it for this community). Returns whether the durable
// mark was written, so the caller never claims remembrance the code did not keep.
export const joinCommunityWithInvite = async (uid: string, invite: CommunityInvite): Promise<{ remembered: boolean }> => {
    await firestoreStore.link(uid, 'member', invite.communityId, { inviteId: invite.id });
    // The mark is best-effort: membership must stand even if provenance is somehow refused.
    try {
        await firestoreStore.link(uid, 'invited_by', invite.communityId, { inviteId: invite.id });
        return { remembered: true };
    } catch { return { remembered: false }; }
};

// All events created under a community, newest first. Single-field query (no composite
// index); we filter to event pulses and sort client-side.
// `levels` is the set of visibility levels the viewer may read (from queryableLevels). When
// given, the query requests only those, so Firestore never rejects it for a non-member who
// would otherwise have a members-only event in the result set. Omit on fully-public callers.
export const getCommunityEvents = async (communityId: string, levels?: PulseVisibility[]): Promise<Pulse[]> => {
    const base = where('communityId', '==', communityId);
    const q = levels && levels.length
        ? query(pulsesCollection, base, where('visibility', 'in', levels))
        : query(pulsesCollection, base);
    const snap = await getDocs(q);
    return snap.docs
        .map(d => (mapDoc(d) as Pulse))
        .filter(p => p.type === 'event')
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
};

// One-time migration for fully-enforced visibility: stamp every pre-existing pulse that lacks
// a `visibility` with 'public', so the visibility-scoped `in` queries include legacy pulses
// (an `in` filter skips docs missing the field). Staff-run, safe to re-run. Returns the count.
export const backfillPulseVisibility = async (): Promise<number> => {
    const snap = await getDocs(pulsesCollection);
    const missing = snap.docs.filter(d => d.data().visibility === undefined);
    for (let i = 0; i < missing.length; i += 400) {
        const batch = writeBatch(db);
        missing.slice(i, i + 400).forEach(d => batch.update(d.ref, { visibility: 'public' }));
        await batch.commit();
    }
    return missing.length;
};

// One-time migration to canonical pulse types. Casing/identity previously encoded meaning:
// 'GROWTH' = tree growth, lowercase 'growth' = vision growth, 'STANDARD' = alignment. We map,
// per doc by EXACT legacy value: GROWTH→tree_growth, growth→vision_growth, STANDARD→standard.
// New writes already use the canonical tokens (tree_growth/vision_growth/standard), which are NOT
// remap keys — so running this during/after deploy can never corrupt a freshly-written pulse.
// Staff-run, idempotent. Returns the count rewritten.
export const migratePulseTypeCasing = async (): Promise<number> => {
    const snap = await getDocs(pulsesCollection);
    const remap: Record<string, string> = { GROWTH: 'tree_growth', growth: 'vision_growth', STANDARD: 'standard' };
    const toFix = snap.docs.filter(d => remap[(d.data() as any).type] !== undefined);
    for (let i = 0; i < toFix.length; i += 400) {
        const batch = writeBatch(db);
        toFix.slice(i, i + 400).forEach(d => batch.update(d.ref, { type: remap[(d.data() as any).type] }));
        await batch.commit();
    }
    return toFix.length;
};

// Backfill: stamp visibility:'public' on every tree that lacks it, so the visibility-filtered
// forest queries match them. Run ONCE (superadmin) after deploying the lifetrees indexes; safe to
// re-run (idempotent).
export const migrateTreeVisibility = async (): Promise<{ updated: number }> => {
    const snap = await getDocs(lifetreesCollection);
    const toFix = snap.docs.filter(d => !(d.data() as any).visibility);
    for (let i = 0; i < toFix.length; i += 400) {
        const batch = writeBatch(db);
        toFix.slice(i, i + 400).forEach(d => batch.update(d.ref, { visibility: 'public' }));
        await batch.commit();
    }
    console.log('[lightseed] tree visibility backfill:', { updated: toFix.length });
    return { updated: toFix.length };
};

// --- LIN migration: legacy relationship arrays → the `links` collection ---------------------
// Stage 3 of the crystal. Create one link doc per relationship (deterministic id → idempotent).
// Run from the superadmin console AFTER the links rules are deployed; safe to re-run.
const linkDocId = (from: string, rel: string, to: string) => `${from}__${rel}__${to}`;

export const migrateArraysToLinks = async (): Promise<Record<string, number>> => {
    const counts: Record<string, number> = {};
    const queued: { id: string; data: any }[] = [];
    const add = (from: string, rel: string, to: string) => {
        if (!from || !to) return;
        queued.push({ id: linkDocId(from, rel, to), data: { lid: uuidv7(), type: 'link', rel, from, to, createdAt: serverTimestamp() } });
        counts[rel] = (counts[rel] || 0) + 1;
    };
    (await getDocs(lifetreesCollection)).forEach(d => {
        const t = d.data() as any;
        (t.coOwnerIds || []).forEach((u: string) => add(u, 'co_owner', d.id));
        (t.guardians || []).forEach((u: string) => add(u, 'guardian', d.id));
        (t.stewardIds || []).forEach((u: string) => add(u, 'steward', d.id));
        (t.observerIds || []).forEach((u: string) => add(u, 'observer', d.id));
    });
    (await getDocs(communitiesCollection)).forEach(d => {
        ((d.data() as any).memberIds || []).forEach((u: string) => add(u, 'member', d.id));
    });
    (await getDocs(visionsCollection)).forEach(d => {
        ((d.data() as any).joinedUserIds || []).forEach((u: string) => add(u, 'joined', d.id));
    });
    for (let i = 0; i < queued.length; i += 400) {
        const batch = writeBatch(db);
        queued.slice(i, i + 400).forEach(q => batch.set(doc(db, 'links', q.id), q.data));
        await batch.commit();
    }
    return { ...counts, total: queued.length };
};

// Stage 5: remove the now-redundant legacy arrays. Run ONLY after the app + rules are fully on
// links and verified. Idempotent.
export const dropLegacyArrays = async (): Promise<number> => {
    let n = 0;
    const clear = async (coll: typeof lifetreesCollection, fields: string[]) => {
        const docs = (await getDocs(coll)).docs.filter(d => fields.some(f => (d.data() as any)[f] !== undefined));
        for (let i = 0; i < docs.length; i += 400) {
            const batch = writeBatch(db);
            docs.slice(i, i + 400).forEach(d => { const upd: any = {}; fields.forEach(f => (upd[f] = deleteField())); batch.update(d.ref, upd); });
            await batch.commit();
            n += Math.min(400, docs.length - i);
        }
    };
    await clear(lifetreesCollection, ['guardians', 'coOwnerIds', 'stewardIds', 'observerIds']);
    await clear(communitiesCollection, ['memberIds']);
    await clear(visionsCollection, ['joinedUserIds']);
    return n;
};

// One-time migration to a fully lid-carrying data model: mint a `lid` (Lightseed ID, UUIDv7)
// on every doc that lacks one, across the core entity collections. The lid is seeded from the
// doc's createdAt millis — uuidv7(createdAt.toMillis()) — so the birth-time embedded in the id
// is the entity's TRUE birth time (docs with no createdAt fall back to now).
// Sealed pulses (hashVersion set) are SKIPPED: `lid` is canonical block content
// (BLOCK_CONTENT_FIELDS), so adding it post-seal would break hash verification — and every
// sealed block was minted with its lid already. Staff-run, idempotent. Returns per-collection
// counts (+ how many sealed pulses were left untouched, expected 0).
export const migrateBackfillLids = async (): Promise<Record<string, number>> => {
    const targets: [string, CollectionReference<DocumentData>][] = [
        ['communities', communitiesCollection],
        ['lifetrees', lifetreesCollection],
        ['visions', visionsCollection],
        ['pulses', pulsesCollection],
        ['sanctuaries', sanctuariesCollection],
        ['persons', collection(db, 'persons')],
    ];
    const counts: Record<string, number> = {};
    let total = 0, skippedSealed = 0;
    for (const [name, ref] of targets) {
        const snap = await getDocs(ref);
        const missing = snap.docs.filter(d => {
            const data = d.data();
            if (data.lid !== undefined) return false;
            if (name === 'pulses' && data.hashVersion !== undefined) { skippedSealed++; return false; }
            return true;
        });
        for (let i = 0; i < missing.length; i += 400) {
            const batch = writeBatch(db);
            missing.slice(i, i + 400).forEach(d => batch.update(d.ref, { lid: uuidv7(toMillis(d.data().createdAt) || Date.now()) }));
            await batch.commit();
        }
        counts[name] = missing.length;
        total += missing.length;
        console.log(`[lightseed] lid backfill — ${name}: ${missing.length} doc(s) stamped`);
    }
    if (skippedSealed > 0) console.warn(`[lightseed] lid backfill — ${skippedSealed} sealed pulse(s) missing a lid were left untouched (lid is sealed block content).`);
    return { ...counts, skippedSealed, total };
};

// --- Organisation collabs -------------------------------------------------------------
// The Collabs page lists this node's collaborators: the AI intelligences (live from the
// intelligences config) AND organisations whose founder(s) agreed to stand here — or who hold a
// place by contract (as Claude/Anthropic does). World-readable; added by validated/initiated
// members (their being stands behind the entry), tended by their creator or staff.
// An org entry is the bridge to another regen org's world: once it grows a community here
// (`communityId`), information flows through that link and the org's members find the forest.
export interface OrgCollab extends Being {
    id: string;
    name: string;
    url?: string;
    blurb?: string;
    agreement: 'founder' | 'contract';
    logoUrl?: string;      // square brand mark shown on the org card
    communityId?: string;  // the community this org grew here, once it exists
    createdBy?: string;    // uid of the member who added the org — may tend/delete it
}

const collabsCollection = collection(db, 'collabs');

export const getOrgCollabs = async (): Promise<OrgCollab[]> =>
    (await getDocs(collabsCollection)).docs
        .map(d => (mapDoc(d) as OrgCollab))
        .sort((a, b) => (toMillis(a.createdAt) || 0) - (toMillis(b.createdAt) || 0)); // oldest first — the order they joined

export const addOrgCollab = async (data: { name: string; url?: string; blurb?: string; agreement: 'founder' | 'contract'; logoUrl?: string; createdBy: string }): Promise<string> => {
    if (!data.name.trim()) throw new Error('The organisation needs a name.');
    const ref = await addDoc(collabsCollection, {
        lid: uuidv7(),
        name: data.name.trim(),
        url: data.url?.trim() || '',
        blurb: data.blurb?.trim() || '',
        agreement: data.agreement,
        ...(data.logoUrl ? { logoUrl: data.logoUrl } : {}),
        createdBy: data.createdBy,
        createdAt: serverTimestamp(),
    });
    return ref.id;
};

// Tend an org entry. Rules allow staff any change; the org's creator only the
// communityId/logoUrl/blurb fields (field-level diff, like alignments).
export const updateOrgCollab = (id: string, data: Partial<Pick<OrgCollab, 'communityId' | 'logoUrl' | 'blurb'>>) =>
    updateDoc(doc(db, 'collabs', id), data);

export const removeOrgCollab = (id: string) => deleteDoc(doc(db, 'collabs', id));

// --- Tree ↔ community invites ---------------------------------------------------------
// A community invites a LIFETREE to stand with it. The tree's owner accepts, which mints the
// same 'participant' link trees use to join events and visions (from = treeId, to = communityId),
// so the community's trees tab and getParticipatingTrees see it with no new machinery. The links
// rule already allows this: the invitee IS the tree's owner.
export interface CommunityTreeInvite {
    id: string;
    communityId: string;
    communityName: string;
    lifetreeId: string;
    lifetreeName: string;
    invitedUserId: string;    // the tree's owner — who must accept
    invitedByUserId: string;
    status: 'pending' | 'accepted' | 'declined';
    createdAt?: any;
}

const communityTreeInvitesCollection = collection(db, 'communityTreeInvites');

export const inviteTreeToCommunity = async (params: {
    communityId: string; communityName: string;
    lifetreeId: string; lifetreeName: string; treeOwnerId: string;
    invitedByUserId: string;
}): Promise<string> => {
    // One pending invite per tree+community.
    const existing = await getDocs(query(communityTreeInvitesCollection, where('lifetreeId', '==', params.lifetreeId)));
    if (existing.docs.some(d => { const x = d.data() as any; return x.communityId === params.communityId && x.status === 'pending'; })) {
        throw new Error('That tree already has a pending invite to this community.');
    }
    // Already participating? The link is the source of truth.
    if ((await getDoc(doc(db, 'links', `${params.lifetreeId}__participant__${params.communityId}`))).exists()) {
        throw new Error('That tree already stands with this community.');
    }
    const ref = await addDoc(communityTreeInvitesCollection, {
        communityId: params.communityId, communityName: params.communityName,
        lifetreeId: params.lifetreeId, lifetreeName: params.lifetreeName,
        invitedUserId: params.treeOwnerId, invitedByUserId: params.invitedByUserId,
        status: 'pending', createdAt: serverTimestamp(),
    });
    return ref.id;
};

export const getMyCommunityTreeInvites = async (uid: string): Promise<CommunityTreeInvite[]> =>
    (await getDocs(query(communityTreeInvitesCollection, where('invitedUserId', '==', uid))))
        .docs.map(d => (mapDoc(d) as CommunityTreeInvite)).filter(i => i.status === 'pending');

export const respondCommunityTreeInvite = async (invite: CommunityTreeInvite, accept: boolean): Promise<void> => {
    if (accept) {
        // The participant link — same shape the adapter mints for events/visions.
        await setDoc(doc(db, 'links', `${invite.lifetreeId}__participant__${invite.communityId}`), {
            lid: uuidv7(), type: 'link', rel: 'participant', from: invite.lifetreeId, to: invite.communityId, createdAt: serverTimestamp(),
        });
    }
    await updateDoc(doc(db, 'communityTreeInvites', invite.id), {
        status: accept ? 'accepted' : 'declined', respondedAt: serverTimestamp(),
    });
};
