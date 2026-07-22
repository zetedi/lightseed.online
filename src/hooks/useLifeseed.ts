
import { useState, useEffect } from 'react';
import { setDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase/core';
import { uuidv7 } from '../utils/id';
import { onAuthChange, getMyLifetrees, getGuardedTrees, checkIsAdmin, checkIsSuperAdmin, getSuperAdminUid, claimSuperAdmin, listenToUserProfile, updateUserProfile, ensurePersonEntity } from '../services/firebase';
import { getInitiateByUid, type Initiate } from '../domain/initiation';
import { type Lightseed, type Lifetree } from '../types';

const SUPERADMIN_EMAIL = 'zetedi@gmail.com';


// Owned trees split into what a being WEARS (personal lifetrees) and what it GUARDS
// (nature trees). Legacy nature trees planted before the guardian edge existed are merged
// into the guarded list and their missing 'guardian' link is self-healed, best-effort.
const splitTreeLists = (uid: string, owned: Lifetree[], guarded: Lifetree[]): { personal: Lifetree[]; guardedAll: Lifetree[] } => {
    const personal = owned.filter(t => !t.isNature);
    const ownedNature = owned.filter(t => t.isNature);
    const guardedIds = new Set(guarded.map(t => t.id));
    for (const t of ownedNature.filter(x => !guardedIds.has(x.id))) {
        setDoc(doc(db, 'links', `${uid}__guardian__${t.id}`),
            { lid: uuidv7(), type: 'link', rel: 'guardian', from: uid, to: t.id, createdAt: serverTimestamp() }).catch(() => {});
    }
    const guardedAll = [...guarded, ...ownedNature.filter(x => !guardedIds.has(x.id))];
    return { personal, guardedAll };
};

export const useLifeseed = () => {
    const [lightseed, setLightseed] = useState<Lightseed | null>(null);
    const [myTrees, setMyTrees] = useState<Lifetree[]>([]);
    const [guardedTrees, setGuardedTrees] = useState<Lifetree[]>([]);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    const [superAdminExists, setSuperAdminExists] = useState(true);
    // The initiated layer (git ledger, mirrored to /initiates.json) — null until resolved.
    const [initiate, setInitiate] = useState<Initiate | null>(null);
    const [loading, setLoading] = useState(true);
    // The user's chosen "closest" tree (users/{uid}.defaultTreeId). Drives `activeTree`.
    const [defaultTreeId, setDefaultTreeId] = useState<string | undefined>(undefined);
    // The user's chosen default VISION (users/{uid}.defaultVisionId) — the star among visions,
    // mirroring the default tree; the tend corner offers it beside the tree when set.
    const [defaultVisionId, setDefaultVisionId] = useState<string | undefined>(undefined);

    useEffect(() => {
        const authTimeout = window.setTimeout(() => {
            setLoading(false);
            console.warn("Auth state took too long to resolve; continuing without blocking the app shell.");
        }, 12000);

        const unsub = onAuthChange(async (user) => {
            window.clearTimeout(authTimeout);
            if (user) {
                setLightseed({
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName,
                    photoURL: user.photoURL
                });

                // Trees — critical, must not be blocked by admin check errors
                try {
                    const [owned, guarded] = await Promise.all([
                        getMyLifetrees(user.uid),
                        getGuardedTrees(user.uid),
                    ]);
                    const { personal, guardedAll } = splitTreeLists(user.uid, owned, guarded);
                    setMyTrees(personal);
                    setGuardedTrees(guardedAll);
                } catch (e) {
                    console.error("Failed to fetch user trees", e);
                }

                // Identity Stage 1: ensure this user has a canonical person entity (idempotent).
                ensurePersonEntity(user.uid, user.displayName).catch(() => {});

                // The initiated layer: is this account bound to a git-ledger initiate? Best-effort.
                getInitiateByUid(user.uid).then(setInitiate).catch(() => setInitiate(null));

                // Roles — email-based superadmin takes priority, Firestore checks are best-effort
                const emailIsSuperAdmin = user.email === SUPERADMIN_EMAIL;
                let firestoreSuperAdmin = false;
                let firestoreAdmin = false;
                let superAdminUid: string | null = null;
                try {
                    [firestoreAdmin, firestoreSuperAdmin, superAdminUid] = await Promise.all([
                        checkIsAdmin(user.uid),
                        checkIsSuperAdmin(user.uid),
                        getSuperAdminUid(),
                    ]);
                } catch (e) {
                    console.warn("Admin check failed (permissions?), falling back to email check", e);
                }

                const resolvedSuperAdmin = emailIsSuperAdmin || firestoreSuperAdmin;
                setIsSuperAdmin(resolvedSuperAdmin);
                setIsAdmin(resolvedSuperAdmin || firestoreAdmin);
                setSuperAdminExists(!!superAdminUid || emailIsSuperAdmin);

                // Auto-claim Firestore superadmin record for the designated email
                if (emailIsSuperAdmin && !superAdminUid) {
                    claimSuperAdmin(user.uid).catch(() => {});
                }
            } else {
                setLightseed(null);
                setMyTrees([]);
                setGuardedTrees([]);
                setIsAdmin(false);
                setIsSuperAdmin(false);
                setInitiate(null);
            }
            setLoading(false);
        });
        return () => {
            window.clearTimeout(authTimeout);
            unsub();
        };
    }, []);

    // Track the user's chosen default tree from their profile (live).
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- clears the default tree when the user signs out
        if (!lightseed?.uid) { setDefaultTreeId(undefined); setDefaultVisionId(undefined); return; }
        const unsub = listenToUserProfile(lightseed.uid, (data) => {
            setDefaultTreeId(data?.defaultTreeId || undefined);
            setDefaultVisionId(data?.defaultVisionId || undefined);
        });
        return () => unsub();
    }, [lightseed?.uid]);

    const refreshTrees = async () => {
        if (lightseed) {
            const [owned, guarded] = await Promise.all([
                getMyLifetrees(lightseed.uid),
                getGuardedTrees(lightseed.uid)
            ]);
            const { personal, guardedAll } = splitTreeLists(lightseed.uid, owned, guarded);
            setMyTrees(personal);
            setGuardedTrees(guardedAll);
        }
    };

    // Persist the default tree; the profile listener echoes it back into defaultTreeId.
    const setDefaultTree = async (treeId: string) => {
        if (!lightseed?.uid) return;
        setDefaultTreeId(treeId); // optimistic
        await updateUserProfile(lightseed.uid, { defaultTreeId: treeId }).catch(() => {});
    };

    // Persist the default vision the same way (starring it again clears the star).
    const setDefaultVision = async (visionId: string | null) => {
        if (!lightseed?.uid) return;
        setDefaultVisionId(visionId || undefined); // optimistic
        await updateUserProfile(lightseed.uid, { defaultVisionId: visionId || '' }).catch(() => {});
    };

    // The "closest" tree: the chosen default if it's still one of mine, else the first.
    const activeTree = myTrees.find(t => t.id === defaultTreeId) || (myTrees.length > 0 ? myTrees[0] : null);
    return { lightseed, myTrees, guardedTrees, activeTree, defaultTreeId, setDefaultTree, defaultVisionId, setDefaultVision, isAdmin, isSuperAdmin, superAdminExists, initiate, isInitiate: !!initiate, loading, refreshTrees };
};
