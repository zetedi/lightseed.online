import { collection, query, orderBy, getDocs, addDoc, serverTimestamp, doc, runTransaction, getDoc, where, updateDoc, deleteDoc, limit, startAfter, QueryDocumentSnapshot, writeBatch, deleteField, getCountFromServer } from 'firebase/firestore';
import { type Pulse, type Vision, type Community } from '../../types';
import { uuidv7 } from '../../utils/id';
import { type PulseVisibility } from '../../domain/pulse';
import { db, toMillis, mapDoc, lifetreesCollection, visionsCollection, pulsesCollection, communitiesCollection } from './core';
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

export const createVision = async (data: any) => {
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

export const getMyCommunities = async (uid: string) => 
    (await getDocs(query(communitiesCollection, where('ownerId', '==', uid)))).docs.map(d => (mapDoc(d) as Community));

export const COMMUNITY_INVITE_ALLOTMENT = 144;

export const createCommunity = async (data: any) => {
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
    return { id: docRef.id, lid, ...data };
};

export const updateCommunity = (id: string, data: any) => 
    updateDoc(doc(db, 'communities', id), { ...data, updatedAt: serverTimestamp() });

export const deleteCommunity = (id: string) => deleteDoc(doc(db, 'communities', id));

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
