import { collection, query, orderBy, getDocs, addDoc, setDoc, serverTimestamp, doc, getDoc, where, updateDoc, deleteDoc, limit, startAfter, QueryDocumentSnapshot, getCountFromServer, Timestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { type Lifetree, type Sanctuary, type TreeOwnershipInvite, type InvitableRole } from '../../types';
import { createBlock } from '../../utils/crypto';
import { treePlantingGate, normalizeNodeLimits, DEFAULT_NODE_LIMITS, type NodeLimits } from '../../domain/limits';
import { uuidv7 } from '../../utils/id';
import { GENESIS_MOMENT_MS, GENESIS_PLACE } from '../../domain/genesis';
import { oldEmeraldEarthThemeValues } from '../../utils/theme';
import { auth, db, functions, mapDoc, lifetreesCollection, visionsCollection, sanctuariesCollection } from './core';
// getCommunityByDomain lives in ./spaces; trees ↔ spaces is a runtime-safe cycle (both use the
// import only inside function bodies, so ESM resolves the binding lazily on call).
import { getCommunityByDomain } from './spaces';

// Mahameru's face — a starry sky bearing Orion, in the code so it travels with every node.
// When no trees are planted, this is what remains: the sea of creation.
export const MAHAMERU_IMAGE = '/mahameru.svg';
// The Moment — see domain/genesis.ts: the one timestamp the network grows from.

export const ensureGenesis = async () => {
    const user = auth.currentUser;
    if (!user) return; // Skip if not logged in to avoid permission errors on config/superadmin

    const genesisId = 'GENESIS_TREE';
    const genesisRef = doc(db, 'lifetrees', genesisId);
    try {
        const genesisSnap = await getDoc(genesisRef);
        // Mahameru wears the starry sky, whatever it wore before (the doc once carried a
        // flower-of-life image, which outranked every fallback). latestGrowthUrl is the
        // display cache that wins over imageUrl in the renderers — align both. Staff-run.
        if (genesisSnap.exists()) {
            const g = genesisSnap.data() as any;
            const momentDrifted = (g.createdAt?.toMillis?.() !== GENESIS_MOMENT_MS) || !g.plantedAt;
            if ((g.imageUrl !== MAHAMERU_IMAGE || (g.latestGrowthUrl && g.latestGrowthUrl !== MAHAMERU_IMAGE) || momentDrifted)
                && await checkIsSuperAdmin(user.uid)) {
                await updateDoc(genesisRef, {
                    imageUrl: MAHAMERU_IMAGE, latestGrowthUrl: MAHAMERU_IMAGE,
                    // The Moment is the one: birth, place and meaning stay golden.
                    createdAt: Timestamp.fromMillis(GENESIS_MOMENT_MS),
                    plantedAt: Timestamp.fromMillis(GENESIS_MOMENT_MS),
                    plantedLatitude: GENESIS_PLACE.latitude,
                    plantedLongitude: GENESIS_PLACE.longitude,
                    plantedAltitudeM: GENESIS_PLACE.altitudeM,
                    latitude: GENESIS_PLACE.latitude,
                    longitude: GENESIS_PLACE.longitude,
                    locationName: GENESIS_PLACE.name,
                }).catch(() => {});
            }
        }
        if (!genesisSnap.exists()) {
            // Only Super Admins can initialize genesis on a new node
            const isSuper = await checkIsSuperAdmin(user.uid);
            if (!isSuper) return;

            const genesisBody = `The purpose of lightseed is to bring joy. The joy of realizing the bliss of conscious, compassionate, grateful existence by opening a portal to the center of life. By creating a bridge between creator and creation, science and spirituality, virtual and real, nothing and everything. It is designed to intimately connect our inner Self, our culture, our trees and the tree of life, the material and the digital, online world into a sustainable and sustaining circle of unified vibration, sound and light. It aims to merge us into a common flow for all beings to be liberated, wise, strong, courageous and connected. It is rooted in nonviolence, compassion, generosity, gratitude and love. It is blockchain (truthfulness), cloud (global, distributed, resilient), ai (for connecting dreams and technology), regen (nature centric) native. It is an inspiration, an impulse towards a quantum leap in consciousness, a prompt both for human and artificial intelligence for action towards transcending humanity into a new era, a New Earth, Universe and Field with the help of our most important evolutionary sisters and brothers, the trees.`;
            const genesisHash = await createBlock("0", { message: "Genesis Pulse" }, Date.now());
            await setDoc(genesisRef, {
                lid: uuidv7(),
                ownerId: 'GENESIS_SYSTEM', name: 'Mahameru', shortTitle: 'Live Light', body: genesisBody,
                imageUrl: MAHAMERU_IMAGE,
                latitude: GENESIS_PLACE.latitude, longitude: GENESIS_PLACE.longitude, locationName: GENESIS_PLACE.name,
                createdAt: Timestamp.fromMillis(GENESIS_MOMENT_MS),
                plantedAt: Timestamp.fromMillis(GENESIS_MOMENT_MS),
                plantedLatitude: GENESIS_PLACE.latitude, plantedLongitude: GENESIS_PLACE.longitude,
                plantedAltitudeM: GENESIS_PLACE.altitudeM,
                genesisHash, latestHash: genesisHash, blockHeight: 0,
                validated: true, validatorId: 'SYSTEM', isNature: true, domain: 'lightseed.online'
            });
            await setDoc(doc(db, 'visions', 'GENESIS_VISION'), {
                lid: uuidv7(),
                lifetreeId: genesisId, authorId: 'GENESIS_SYSTEM', title: "Mahameru", body: genesisBody, createdAt: serverTimestamp(), domain: 'lightseed.online'
            });
        }

        // Ensure default organizations for white-labeling
        const isSuper = await checkIsSuperAdmin(user.uid);
        if (isSuper) {
            const defaultOrgs = [
                {
                    id: 'lightseed.online',
                    name: 'lightseed',
                    domain: 'lightseed.online',
                    vision: 'Universal connection through nature and digital roots.',
                    imageUrls: [],
                    ownerId: user.uid,
                    theme: {
                        primary: '#059669',
                        secondary: '#0284c7',
                        accent: '#f59e0b',
                        neutral: '#334155',
                        background: '#ffffff',
                        surface: '#ffffff',
                        text: '#0f172a',
                        mode: 'light'
                    }
                },
                {
                    id: 'lifeseed.online',
                    name: 'lifeseed',
                    domain: 'lifeseed.online',
                    vision: 'A lively network for seeding growth and vitality.',
                    imageUrls: [],
                    ownerId: user.uid,
                    theme: { ...oldEmeraldEarthThemeValues }
                }
            ];

            for (const community of defaultOrgs) {
                const existingCommunity = await getCommunityByDomain(community.domain);
                if (!existingCommunity) {
                    const communityRef = doc(db, 'communities', community.id);
                    await setDoc(communityRef, {
                        ...community,
                        lid: uuidv7(), // every being is born with its Lightseed ID
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp()
                    });
                    console.log(`Initialized default community: ${community.domain}`);
                }
            }
        }
    } catch (e) { console.warn("Genesis skip", e); }
}

// Mirror the git initiation ledger into Firestore so the security rules can check initiate rights
// server-side. Git is the source of truth (initiations/ in the repo, three-sponsor rule in CI);
// public/initiates.json is the build-time mirror; this pushes uid-bound records into
// initiates/{uid} and removes stale ones. Superadmin-only (the rules make initiates staff-write),
// best-effort, and run beside ensureGenesis on sign-in — so a deploy carrying a new initiate
// self-heals the mirror the next time the superadmin opens the app.
export const syncInitiatesMirror = async () => {
    const user = auth.currentUser;
    if (!user || !(await checkIsSuperAdmin(user.uid))) return;
    try {
        const { loadInitiates } = await import('../../domain/initiation');
        const ledger = (await loadInitiates()).filter(i => i.uid);
        const current = await getDocs(collection(db, 'initiates'));
        const wanted = new Map(ledger.map(i => [i.uid as string, i]));
        // Remove mirror docs the ledger no longer holds; write/update the ones it does.
        for (const d of current.docs) {
            if (!wanted.has(d.id)) await deleteDoc(d.ref);
        }
        for (const i of ledger) {
            await setDoc(doc(db, 'initiates', i.uid as string), {
                handle: i.handle, name: i.name, lid: i.lid, pubkey: i.pubkey,
                ...(i.domain ? { domain: i.domain } : {}),
                ...(i.genesis ? { genesis: true } : {}),
                initiatedAt: i.initiatedAt,
                syncedAt: serverTimestamp(),
            });
        }
    } catch (e) { console.warn('Initiates mirror sync skipped', e); }
};

// The real, on-chain hash of block 000 — the genesis pulse the whole network grows from.
// Shared by every node, so the about page can show the true founding hash. Returns null
// if the genesis tree isn't reachable (callers fall back to a placeholder).
export const getGenesisHash = async (): Promise<string | null> => {
    try {
        const snap = await getDoc(doc(db, 'lifetrees', 'GENESIS_TREE'));
        return snap.exists() ? ((snap.data() as Lifetree).genesisHash ?? null) : null;
    } catch (e) {
        console.warn("Genesis hash unavailable", e);
        return null;
    }
};

// Forest-card counters. On the hub the whole node counts; on a custom domain only that
// place's life counts (privacy of the place — its numbers are its own).
export const getNetworkStats = async (domain?: string) => {
    try {
        const scoped = !!(domain && !isHubDomain(domain));
        const d = domain?.replace(/^www\./, '');
        const scope = (coll: string) => scoped
            ? query(collection(db, coll), where('domain', '==', d))
            : collection(db, coll);
        const [trees, pulses, visions] = await Promise.all([
            getCountFromServer(scope('lifetrees')),
            getCountFromServer(scope('pulses')),
            getCountFromServer(scope('visions'))
        ]);
        return {
            trees: trees.data().count,
            pulses: pulses.data().count,
            visions: visions.data().count
        };
    } catch (e) {
        console.error("Failed to fetch network stats:", e);
        return { trees: 0, pulses: 0, visions: 0 };
    }
}

// The node's planting caps, set by node admins on the admin page (config/limits, world-readable);
// nodes that never touched them get the defaults (12 lifetrees + 132 guarded = 144).
export const getNodeLimits = async (): Promise<NodeLimits> => {
    try {
        const snap = await getDoc(doc(db, 'config', 'limits'));
        return snap.exists() ? normalizeNodeLimits(snap.data()) : DEFAULT_NODE_LIMITS;
    } catch {
        return DEFAULT_NODE_LIMITS;
    }
};

// Staff-only by Firestore rules — the node admin page saves the caps here.
export const setNodeLimits = (limits: NodeLimits) =>
    setDoc(doc(db, 'config', 'limits'), normalizeNodeLimits(limits) as any, { merge: true });

export const plantLifetree = async (data: Partial<Lifetree> & { ownerId: string; name: string; body?: string }) => {
    // Quality, not quantity: the node's caps (or the 12 + 132 = 144 defaults) per being.
    const plantingType: 'LIFETREE' | 'GUARDED' = (data.treeType as any) || (data.isNature ? 'GUARDED' : 'LIFETREE');
    const [mine, limits] = await Promise.all([getMyLifetrees(data.ownerId), getNodeLimits()]);
    const refusal = treePlantingGate(mine, plantingType, limits);
    if (refusal) throw new Error(refusal);

    const genesisHash = await createBlock("0", { msg: "Birth" }, Date.now());
    const currentHost = window.location.hostname.replace(/^www\./, '');
    // On a custom domain the tree belongs to that community — its canonical domain wins over
    // the raw hostname (so per-auset.web.app trees carry the community's domain, and follow it
    // when the community later moves to its real domain).
    let domain = data.domain;
    if (!domain) {
        if (isHubDomain(currentHost)) domain = 'lightseed.online';
        else domain = (await getCommunityByDomain(currentHost))?.domain || currentHost;
    }

    // New trees inherit the owner's contact-privacy preference so the mirror stays consistent.
    let onlyValidatedCanReach = false;
    try {
        if (data.ownerId) {
            const ownerSnap = await getDoc(doc(db, 'users', data.ownerId));
            onlyValidatedCanReach = ownerSnap.exists() && ownerSnap.data()?.onlyValidatedCanReach === true;
        }
    } catch { /* default false */ }

    const treeDoc = await addDoc(lifetreesCollection, {
        ...data,
        lid: uuidv7(),
        domain,
        onlyValidatedCanReach,
        treeType: data.treeType || (data.isNature ? 'GUARDED' : 'LIFETREE'),
        createdAt: serverTimestamp(), genesisHash, latestHash: genesisHash, blockHeight: 0,
        validated: false, validatorId: null, status: 'HEALTHY'
        // Relations (guardian/co_owner/…) live in the `links` collection — no legacy arrays.
    });
    await addDoc(visionsCollection, {
        lid: uuidv7(),
        lifetreeId: treeDoc.id, authorId: data.ownerId, title: "Root Vision", body: data.body, createdAt: serverTimestamp(), domain
    });
    // A guarded (nature) tree is GUARDED, not worn: its planter is its first guardian —
    // the edge lives in the LIN, and the session lists it under guarded trees, not avatars.
    if (plantingType === 'GUARDED') {
        await setDoc(doc(db, 'links', `${data.ownerId}__guardian__${treeDoc.id}`),
            { lid: uuidv7(), type: 'link', rel: 'guardian', from: data.ownerId, to: treeDoc.id, createdAt: serverTimestamp() }).catch(() => {});
    }
    return treeDoc;
};

export const updateLifetree = (id: string, data: Partial<Lifetree>) => updateDoc(doc(db, 'lifetrees', id), { ...data });
export const deleteLifetree = (id: string) => deleteDoc(doc(db, 'lifetrees', id));
export const validateLifetree = (targetId: string, validatorId: string) => updateDoc(doc(db, 'lifetrees', targetId), { validated: true, validatorId });
export const unvalidateLifetree = (targetId: string) => updateDoc(doc(db, 'lifetrees', targetId), { validated: false, validatorId: null });

export const isHubDomain = (domain?: string) => {
    if (!domain) return true;
    const d = domain.toLowerCase().replace(/^www\./, '');
    return d === 'lightseed.online' || d === 'lifeseed.online' || d === 'localhost' || d === '127.0.0.1' || d.startsWith('192.168.') || d.endsWith('.local');
};

export const fetchLifetrees = async (lastD?: QueryDocumentSnapshot, domainFilter?: string, ownerUid?: string, levels?: string[] | null) => {
    const communityScoped = !!(domainFilter && !isHubDomain(domainFilter));
    // Only return trees this viewer may read (visibility levels), matching the rules — else the
    // list query is rejected. levels null/empty = no filter (staff / legacy callers).
    const visCons = (levels && levels.length) ? [where('visibility', 'in', levels)] : [];
    let q;
    if (communityScoped) {
        // Community View: narrow to the community's domain (remove orderBy to avoid composite index)
        q = query(lifetreesCollection, where('domain', '==', domainFilter!.replace(/^www\./, '')), ...visCons, limit(24));
    } else {
        q = query(lifetreesCollection, ...visCons, orderBy('createdAt', 'desc'), limit(12));
    }

    if (lastD) q = query(q, startAfter(lastD));
    let snap;
    try {
        snap = await getDocs(q);
    } catch (e) {
        // The composite (visibility + createdAt/domain) index may still be building — fall back
        // to a filter-only query (single-field index) so the forest keeps loading; sorted below.
        console.warn('Forest query fell back (visibility index building?)', e);
        snap = await getDocs(visCons.length ? query(lifetreesCollection, ...visCons, limit(60)) : query(lifetreesCollection, limit(60)));
    }
    let items = snap.docs.map(d => (mapDoc(d) as Lifetree));
    // Always newest-first (covers the unordered fallback).
    items = items.sort((a, b) => ((b.createdAt as any)?.toMillis?.() || 0) - ((a.createdAt as any)?.toMillis?.() || 0));

    // Pre-backfill safety: legacy trees have no `visibility` field, so a filtered query matches
    // none. If the first page comes back empty, retry unfiltered (rules still allow this while no
    // tree is private yet). After migrateTreeVisibility() runs, the filtered query just works.
    if (!lastD && visCons.length && items.length === 0) {
        try {
            const base = communityScoped
                ? query(lifetreesCollection, where('domain', '==', domainFilter!.replace(/^www\./, '')), limit(24))
                : query(lifetreesCollection, orderBy('createdAt', 'desc'), limit(12));
            const s2 = await getDocs(base);
            items = s2.docs.map(d => (mapDoc(d) as Lifetree))
                .sort((a, b) => ((b.createdAt as any)?.toMillis?.() || 0) - ((a.createdAt as any)?.toMillis?.() || 0));
        } catch { /* rules now block unfiltered (private trees exist) — keep empty */ }
    }

    if (communityScoped) {
        // The creator always sees their own trees on a community/custom domain,
        // even if those trees point at a different domain. Merge on the first page.
        if (ownerUid && !lastD) {
            const mine = await getDocs(query(lifetreesCollection, where('ownerId', '==', ownerUid)));
            const seen = new Set(items.map(t => t.id));
            mine.docs.forEach(d => {
                if (!seen.has(d.id)) items.push(mapDoc(d) as Lifetree);
            });
        }
        // Sort client-side since we removed server-side sorting
        items = items.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
    }

    if (!lastD && isHubDomain(domainFilter)) {
        const genesisSnap = await getDoc(doc(db, 'lifetrees', 'GENESIS_TREE'));
        if (genesisSnap.exists()) {
            const genesisTree = { id: genesisSnap.id, ...genesisSnap.data() } as Lifetree;
            if (!items.some(tree => tree.id === genesisTree.id)) {
                items.unshift(genesisTree);
            }
        }
    }

    return { items, lastDoc: snap.docs[snap.docs.length-1] || null };
}

// Whole forest at once (no pagination) — used by the map so every tree appears,
// not just the first page. Includes the creator's own trees and Genesis on the hub.
export const fetchAllLifetrees = async (domainFilter?: string, ownerUid?: string, levels?: string[] | null): Promise<Lifetree[]> => {
    const communityScoped = !!(domainFilter && !isHubDomain(domainFilter));
    const visCons = (levels && levels.length) ? [where('visibility', 'in', levels)] : [];
    const byId = new Map<string, Lifetree>();
    const add = (d: any) => byId.set(d.id, mapDoc(d) as Lifetree);

    try {
        if (communityScoped) {
            (await getDocs(query(lifetreesCollection, where('domain', '==', domainFilter!.replace(/^www\./, '')), ...visCons))).docs.forEach(add);
        } else {
            (await getDocs(query(lifetreesCollection, ...visCons, orderBy('createdAt', 'desc'), limit(1000)))).docs.forEach(add);
        }
    } catch (e) {
        console.warn('Forest map query fell back (visibility index building?)', e);
        (await getDocs(visCons.length ? query(lifetreesCollection, ...visCons, limit(1000)) : query(lifetreesCollection, limit(1000)))).docs.forEach(add);
    }

    // Pre-backfill safety: legacy trees lack `visibility`, so a filtered query matches none.
    // If nothing came back, retry unfiltered (rules allow it while no tree is private yet).
    if (visCons.length && byId.size === 0) {
        try {
            const base = communityScoped
                ? query(lifetreesCollection, where('domain', '==', domainFilter!.replace(/^www\./, '')))
                : query(lifetreesCollection, orderBy('createdAt', 'desc'), limit(1000));
            (await getDocs(base)).docs.forEach(add);
        } catch { /* rules now block unfiltered (private trees exist) — keep empty */ }
    }

    // The creator always sees their own trees, even pointed at another domain.
    if (ownerUid) {
        (await getDocs(query(lifetreesCollection, where('ownerId', '==', ownerUid)))).docs.forEach(add);
    }

    if (!communityScoped) {
        const genesisSnap = await getDoc(doc(db, 'lifetrees', 'GENESIS_TREE'));
        if (genesisSnap.exists()) byId.set(genesisSnap.id, { id: genesisSnap.id, ...(genesisSnap.data() as any) } as Lifetree);
    }

    return Array.from(byId.values());
};

export const getMyLifetrees = async (uid: string) => (await getDocs(query(lifetreesCollection, where('ownerId', '==', uid)))).docs.map(d => (mapDoc(d) as Lifetree));

export const normalizeDomain = (domain: string) =>
    domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');

export const getTreesByDomain = async (domain: string, ownerUid?: string): Promise<Lifetree[]> => {
    const normalized = normalizeDomain(domain);
    // No orderBy — avoids requiring a composite Firestore index
    const q = query(lifetreesCollection, where('domain', '==', normalized));
    const snap = await getDocs(q);
    const byId = new Map<string, Lifetree>();
    snap.docs.forEach(d => byId.set(d.id, mapDoc(d) as Lifetree));

    // The creator always sees their own trees here, even if they pointed a tree
    // at a different domain than this community.
    if (ownerUid) {
        const mine = await getDocs(query(lifetreesCollection, where('ownerId', '==', ownerUid)));
        mine.docs.forEach(d => byId.set(d.id, mapDoc(d) as Lifetree));
    }

    return Array.from(byId.values());
};

// Sanctuaries rooted in a community's domain, earliest first. Mirrors getTreesByDomain
// so the "First Tree" and "The Sanctuary" tabs behave identically.
export const getSanctuariesByDomain = async (domain: string, opts?: { publicOnly?: boolean }): Promise<Sanctuary[]> => {
    const normalized = normalizeDomain(domain);
    const q = opts?.publicOnly
        ? query(sanctuariesCollection, where('domain', '==', normalized), where('visibility', '==', 'public'))
        : query(sanctuariesCollection, where('domain', '==', normalized));
    const snap = await getDocs(q);
    return snap.docs
        .map(d => (mapDoc(d) as Sanctuary))
        .sort((a, b) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0));
};

// Every placed sanctuary in the network — the hub map shows what the viewer may see.
// Signed-out viewers may only query public docs (the read rule rejects wider queries).
export const getAllSanctuaries = async (opts?: { publicOnly?: boolean }): Promise<Sanctuary[]> =>
    (await getDocs(opts?.publicOnly ? query(sanctuariesCollection, where('visibility', '==', 'public')) : sanctuariesCollection))
        .docs.map(d => (mapDoc(d) as Sanctuary));

// Consecrate a sanctuary — community keepers do this from the Sanctuary tab.
export const createSanctuary = async (data: Partial<Sanctuary> & { name: string; ownerId: string }) => {
    const ref = await addDoc(sanctuariesCollection, {
        ...Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined && v !== '')),
        lid: uuidv7(),
        createdAt: serverTimestamp(),
    });
    return ref.id;
};

export const getSanctuaryById = async (id: string): Promise<Sanctuary | null> => {
    const snap = await getDoc(doc(db, 'sanctuaries', id));
    return snap.exists() ? (mapDoc(snap as any) as Sanctuary) : null;
};

// Sanctuaries sheltering a community — belonging lives in the LIN (sanctuary __shelters__
// community), plus the primary communityId scalar for sanctuaries rooted there directly.
export const getSanctuariesByCommunity = async (communityId: string): Promise<Sanctuary[]> => {
    const [links, primary] = await Promise.all([
        getDocs(query(collection(db, 'links'), where('rel', '==', 'shelters'), where('to', '==', communityId))),
        getDocs(query(sanctuariesCollection, where('communityId', '==', communityId))),
    ]);
    const out = new Map<string, Sanctuary>();
    for (const d of primary.docs) out.set(d.id, mapDoc(d) as Sanctuary);
    const missing = links.docs.map(l => (l.data() as any).from).filter((id: string) => !out.has(id));
    const fetched = await Promise.all(missing.map((id: string) => getSanctuaryById(id).catch(() => null)));
    for (const s of fetched) if (s) out.set(s.id, s);
    return [...out.values()];
};

// The sanctuary steps into (shelters) a community — one LIN edge, minted by its keeper.
export const adoptSanctuary = async (sanctuaryId: string, communityId: string) => {
    await setDoc(doc(db, 'links', `${sanctuaryId}__shelters__${communityId}`),
        { lid: uuidv7(), type: 'link', rel: 'shelters', from: sanctuaryId, to: communityId, createdAt: serverTimestamp() });
};

// Move / describe a sanctuary — owner or staff, per the rules. Undefined and empty-string
// values are stripped (belt and braces alongside ignoreUndefinedProperties).
export const updateSanctuary = (sanctuaryId: string, data: Partial<Sanctuary>) =>
    updateDoc(doc(db, 'sanctuaries', sanctuaryId),
        Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined && v !== '')) as any);

// Release a sanctuary — owner or staff, per the rules. Its LIN edges (rooted, shelters)
// are released FIRST (while the ownership check can still see the doc), best-effort.
export const deleteSanctuary = async (sanctuaryId: string) => {
    try {
        const links = await getDocs(query(collection(db, 'links'), where('from', '==', sanctuaryId)));
        await Promise.all(links.docs
            .filter(d => ['rooted', 'shelters'].includes((d.data() as any).rel))
            .map(d => deleteDoc(d.ref).catch(() => {})));
    } catch { /* best-effort — the exists-guarded rules allow later staff cleanup */ }
    await deleteDoc(doc(db, 'sanctuaries', sanctuaryId));
};

// Open a sanctuary wider (or draw it back) — owner or staff, per the rules.
export const setSanctuaryVisibility = (sanctuaryId: string, visibility: 'community' | 'node' | 'public') =>
    updateDoc(doc(db, 'sanctuaries', sanctuaryId), { visibility });

export const checkIsAdmin = async (uid: string): Promise<boolean> => (await getDoc(doc(db, 'admins', uid))).exists();

export const getSuperAdminUid = async (): Promise<string | null> => {
    const snap = await getDoc(doc(db, 'config', 'superadmin'));
    return snap.exists() ? (snap.data() as any).uid : null;
};
export const checkIsSuperAdmin = async (uid: string): Promise<boolean> => (await getSuperAdminUid()) === uid;
export const SUPERADMIN_INVITE_ALLOTMENT = 144;

export const claimSuperAdmin = async (uid: string): Promise<boolean> => {
    const ref = doc(db, 'config', 'superadmin');
    if ((await getDoc(ref)).exists()) return false;
    await setDoc(ref, { uid, claimedAt: serverTimestamp() });
    // Super-admins seed the invite-only network: grant the full allotment.
    try { await updateDoc(doc(db, 'users', uid), { invitesRemaining: SUPERADMIN_INVITE_ALLOTMENT }); } catch (e) { console.warn('Could not set superadmin invites', e); }
    return true;
};
export const grantAdmin = (uid: string) => setDoc(doc(db, 'admins', uid), { grantedAt: serverTimestamp() });
export const revokeAdmin = (uid: string) => deleteDoc(doc(db, 'admins', uid));
export const getAdmins = async (): Promise<{ uid: string }[]> =>
    (await getDocs(collection(db, 'admins'))).docs.map(d => ({ uid: d.id }));
// Trees a user guards — a prism over their outgoing 'guardian' links (the LIN), then hydrate.
export const getGuardedTrees = async (uid: string): Promise<Lifetree[]> => {
    const links = await getDocs(query(collection(db, 'links'), where('from', '==', uid), where('rel', '==', 'guardian')));
    const ids = links.docs.map(d => (d.data() as any).to as string);
    const trees = await Promise.all(ids.map(async id => {
        try {
            const snap = await getDoc(doc(db, 'lifetrees', id));
            return snap.exists() ? ({ id: snap.id, ...(snap.data() as any) } as Lifetree) : null;
        } catch { return null; } // e.g. a guarded tree the owner made private
    }));
    return trees.filter((t): t is Lifetree => t !== null);
};

// Trees participating in an event or vision — a prism over its incoming 'participant' links
// (from = treeId), then hydrate. Mirrors getGuardedTrees but keyed on the target entity.
export const getParticipatingTrees = async (entityId: string): Promise<Lifetree[]> => {
    const links = await getDocs(query(collection(db, 'links'), where('to', '==', entityId), where('rel', '==', 'participant')));
    const ids = links.docs.map(d => (d.data() as any).from as string);
    const trees = await Promise.all(ids.map(async id => {
        try {
            const snap = await getDoc(doc(db, 'lifetrees', id));
            return snap.exists() ? ({ id: snap.id, ...(snap.data() as any) } as Lifetree) : null;
        } catch { return null; } // a participating tree that later went private
    }));
    return trees.filter((t): t is Lifetree => t !== null);
};

// --- Tree Circle: shared care of a Lifetree → a rooted community ---------------
const treeInvitesCollection = collection(db, 'treeOwnershipInvites');

export const createTreeInvite = async (params: {
    lifetree: Lifetree;
    invitedUserId: string;
    role: InvitableRole;
    message?: string;
    invitedByUserId: string;
    invitedByName?: string;
}): Promise<string> => {
    const { lifetree, invitedUserId, role } = params;
    if (!invitedUserId.trim()) throw new Error('Choose someone to invite.');
    if (invitedUserId === lifetree.ownerId) throw new Error('That person already owns this tree.');
    // Already holds this role? Check the LIN link (the single source of truth), not a legacy array.
    if ((await getDoc(doc(db, 'links', `${invitedUserId}__${role}__${lifetree.id}`))).exists()) throw new Error('That person already holds this role.');
    // Single-field query + client filter, to avoid requiring a composite index.
    const existing = await getDocs(query(treeInvitesCollection, where('lifetreeId', '==', lifetree.id)));
    const hasPendingDupe = existing.docs.some(d => {
        const x = d.data() as any;
        return x.invitedUserId === invitedUserId && x.role === role && x.status === 'pending';
    });
    if (hasPendingDupe) throw new Error('There is already a pending invite for this person and role.');
    const ref = await addDoc(treeInvitesCollection, {
        lifetreeId: lifetree.id,
        lifetreeName: lifetree.name || '',
        invitedByUserId: params.invitedByUserId,
        invitedByName: params.invitedByName || '',
        invitedUserId,
        role,
        status: 'pending',
        message: params.message || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });
    return ref.id;
};

export const getPendingTreeInvites = async (userId: string): Promise<TreeOwnershipInvite[]> => {
    // Single-field query + client filter, to avoid requiring a composite index.
    const snap = await getDocs(query(treeInvitesCollection, where('invitedUserId', '==', userId)));
    return snap.docs.map(d => (mapDoc(d) as TreeOwnershipInvite)).filter(i => i.status === 'pending');
};

export const getSentTreeInvites = async (lifetreeId: string): Promise<TreeOwnershipInvite[]> => {
    const snap = await getDocs(query(treeInvitesCollection, where('lifetreeId', '==', lifetreeId)));
    return snap.docs.map(d => (mapDoc(d) as TreeOwnershipInvite));
};

export const declineTreeInvite = (inviteId: string) =>
    updateDoc(doc(db, 'treeOwnershipInvites', inviteId), { status: 'declined', declinedAt: serverTimestamp(), updatedAt: serverTimestamp() });

export const revokeTreeInvite = (inviteId: string) =>
    updateDoc(doc(db, 'treeOwnershipInvites', inviteId), { status: 'revoked', revokedAt: serverTimestamp(), updatedAt: serverTimestamp() });

// Accepting writes the tree's role arrays AND the rooted community — a protected,
// multi-document mutation, so it runs server-side (Cloud Function) with admin rights.
export const acceptTreeInvite = async (inviteId: string): Promise<{ communityId: string; lifetreeId: string }> => {
    const callable = httpsCallable(functions, 'acceptTreeInvite');
    const res = await callable({ inviteId });
    return res.data as { communityId: string; lifetreeId: string };
};

export const setTreeStatus = (id: string, status: string) => updateDoc(doc(db, 'lifetrees', id), { status });
