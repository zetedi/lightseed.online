
import { useState, useEffect } from 'react';
import { onAuthChange, getMyLifetrees, getGuardedTrees, checkIsAdmin, checkIsSuperAdmin, getSuperAdminUid, claimSuperAdmin, listenToUserProfile, updateUserProfile, ensurePersonEntity } from '../services/firebase';
import { getInitiateByUid, type Initiate } from '../domain/initiation';
import { type Lightseed, type Lifetree } from '../types';

const SUPERADMIN_EMAIL = 'zetedi@gmail.com';

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
                    setMyTrees(owned);
                    setGuardedTrees(guarded);
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
        if (!lightseed?.uid) { setDefaultTreeId(undefined); return; }
        const unsub = listenToUserProfile(lightseed.uid, (data) => setDefaultTreeId(data?.defaultTreeId || undefined));
        return () => unsub();
    }, [lightseed?.uid]);

    const refreshTrees = async () => {
        if (lightseed) {
            const [owned, guarded] = await Promise.all([
                getMyLifetrees(lightseed.uid),
                getGuardedTrees(lightseed.uid)
            ]);
            setMyTrees(owned);
            setGuardedTrees(guarded);
        }
    };

    // Persist the default tree; the profile listener echoes it back into defaultTreeId.
    const setDefaultTree = async (treeId: string) => {
        if (!lightseed?.uid) return;
        setDefaultTreeId(treeId); // optimistic
        await updateUserProfile(lightseed.uid, { defaultTreeId: treeId }).catch(() => {});
    };

    // The "closest" tree: the chosen default if it's still one of mine, else the first.
    const activeTree = myTrees.find(t => t.id === defaultTreeId) || (myTrees.length > 0 ? myTrees[0] : null);
    return { lightseed, myTrees, guardedTrees, activeTree, defaultTreeId, setDefaultTree, isAdmin, isSuperAdmin, superAdminExists, initiate, isInitiate: !!initiate, loading, refreshTrees };
};
