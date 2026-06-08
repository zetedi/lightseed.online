
import { useState, useEffect } from 'react';
import { onAuthChange, getMyLifetrees, getGuardedTrees, checkIsAdmin, checkIsSuperAdmin, getSuperAdminUid, claimSuperAdmin } from '../services/firebase';
import { type Lightseed, type Lifetree } from '../types';

const SUPERADMIN_EMAIL = 'zetedi@gmail.com';

export const useLifeseed = () => {
    const [lightseed, setLightseed] = useState<Lightseed | null>(null);
    const [myTrees, setMyTrees] = useState<Lifetree[]>([]);
    const [guardedTrees, setGuardedTrees] = useState<Lifetree[]>([]);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    const [superAdminExists, setSuperAdminExists] = useState(true);
    const [loading, setLoading] = useState(true);

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
            }
            setLoading(false);
        });
        return () => {
            window.clearTimeout(authTimeout);
            unsub();
        };
    }, []);

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
    const activeTree = myTrees.length > 0 ? myTrees[0] : null;
    return { lightseed, myTrees, guardedTrees, activeTree, isAdmin, isSuperAdmin, superAdminExists, loading, refreshTrees };
};
