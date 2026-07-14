import { collection, query, orderBy, getDocs, addDoc, setDoc, serverTimestamp, doc, runTransaction, getDoc, where, updateDoc, limit, startAfter, QueryDocumentSnapshot, writeBatch, onSnapshot, Timestamp } from 'firebase/firestore';
import { signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, updateProfile, type User as FirebaseUser, signOut as firebaseSignOut, deleteUser as firebaseDeleteUser } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { type Pulse, type Lifetree, type Vision } from '../../types';
import { uuidv7 } from '../../utils/id';
import { auth, db, functions, googleProvider, mapDoc, lifetreesCollection, visionsCollection, pulsesCollection, networkInvitesCollection, newsletterConfigRef } from './core';

// Identity Stage 1: the canonical PERSON entity, one per user (doc id = uid, so it's
// deterministic and never duplicated). uid stays the auth key; the person carries a portable
// `lid` and a reserved `publicKeyPem` for later keypair signing. Idempotent get-or-create —
// safe to call on every login (new and existing users). See src/domain/person.ts.
export const ensurePersonEntity = async (uid: string, displayName?: string | null): Promise<{ lid: string; uid: string }> => {
    const ref = doc(db, 'persons', uid);
    const snap = await getDoc(ref);
    if (snap.exists()) {
        const d = snap.data() as any;
        // Backfill a lid if an older person doc somehow lacks one.
        if (!d.lid) { const lid = uuidv7(); await setDoc(ref, { lid }, { merge: true }); return { lid, uid }; }
        return { lid: d.lid as string, uid };
    }
    const lid = uuidv7();
    await setDoc(ref, { lid, uid, displayName: displayName || '', publicKeyPem: null, createdAt: serverTimestamp() });
    return { lid, uid };
};

// A person's public display name by uid (persons/{uid} is world-readable). Used to attribute an
// alignment request to the human behind the initiating tree. Returns undefined if unknown/empty.
export const getPersonName = async (uid: string): Promise<string | undefined> => {
    try {
        const snap = await getDoc(doc(db, 'persons', uid));
        return snap.exists() ? ((snap.data() as any).displayName || undefined) : undefined;
    } catch { return undefined; }
};

// Create the user's profile document the first time they appear. Direct-message email
// notifications are on by default (early network — don't let people miss reaches).
const ensureUserProfile = async (user: FirebaseUser, extra: Record<string, any> = {}): Promise<boolean> => {
    const ref = doc(db, 'users', user.uid);
    if ((await getDoc(ref)).exists()) return false;
    await setDoc(ref, {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || (extra as any).displayName || '',
        createdAt: serverTimestamp(),
        newsletterSubscribed: false,
        emailNotifications: { directMessages: true },
        invitesRemaining: 7,
        dailyAiText: 0,
        dailyAiImage: 0,
        lastAiReset: Date.now(),
        ...extra,
    });
    try {
        await triggerSystemEmail(user.email || "", "Welcome to lightseed",
            `Welcome to lightseed${user.displayName ? ", " + user.displayName : ""}. You have planted your intention. Now you may plant your tree.`, user.uid);
    } catch (e) { console.warn("Welcome email could not be sent:", e); }
    return true;
};

// Throws Error('INVITE_ONLY') when a brand-new account is blocked by invite-only mode.
const resolveInviteOnSignup = async (_email: string | null, opts: { inviteId?: string; inviteOnly?: boolean }): Promise<{ invitedBy?: string; consume?: string }> => {
    if (!opts.inviteOnly) {
        if (!opts.inviteId) return {};
        const invite = await getNetworkInvite(opts.inviteId);
        return invite && invite.status === 'pending' ? { invitedBy: invite.invitedByUserId, consume: invite.id } : {};
    }
    const invite = opts.inviteId ? await getNetworkInvite(opts.inviteId) : null;
    if (!invite || invite.status !== 'pending') throw new Error('INVITE_ONLY');
    return { invitedBy: invite.invitedByUserId, consume: invite.id };
};

export const signInWithGoogle = async (opts: { inviteId?: string; inviteOnly?: boolean } = {}) => {
    googleProvider.setCustomParameters({ prompt: 'select_account' });
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    const existing = await getDoc(doc(db, 'users', user.uid));
    if (!existing.exists()) {
        let resolved;
        try {
            resolved = await resolveInviteOnSignup(user.email, opts);
        } catch (e) {
            await firebaseSignOut(auth); // new account blocked by invite-only
            throw e;
        }
        if (resolved.consume) await consumeNetworkInvite(resolved.consume, user.uid);
        await ensureUserProfile(user, { acceptedTerms: true, ...(resolved.invitedBy ? { invitedBy: resolved.invitedBy } : {}) });
    }
    return user;
};

export const signUpWithEmail = async (email: string, password: string, displayName: string, opts: { inviteId?: string; inviteOnly?: boolean } = {}) => {
    const resolved = await resolveInviteOnSignup(email, opts); // validate the invite before creating the account
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    const user = cred.user;
    if (displayName.trim()) { try { await updateProfile(user, { displayName: displayName.trim() }); } catch {} }
    if (resolved.consume) await consumeNetworkInvite(resolved.consume, user.uid);
    await ensureUserProfile(user, { displayName: displayName.trim(), acceptedTerms: true, ...(resolved.invitedBy ? { invitedBy: resolved.invitedBy } : {}) });
    try { await sendEmailVerification(user); } catch (e) { console.warn("Verification email failed:", e); }
    return user;
};

export const signInWithEmail = (email: string, password: string) =>
    signInWithEmailAndPassword(auth, email.trim(), password).then(c => c.user);

export const sendVerificationEmail = () =>
    auth.currentUser ? sendEmailVerification(auth.currentUser) : Promise.reject(new Error('Not signed in'));

export const resetPassword = (email: string) => sendPasswordResetEmail(auth, email.trim());

// --- Network onboarding invites (distinct from Tree Circle role invites) ----------
// Invite allotments: a node manager (superadmin) is unlimited (pass opts.unlimited); a community
// manager has 144 (granted on createCommunity); a member has the default 7. Unlimited callers
// skip the per-user counter entirely.
export const createNetworkInvite = async (email: string, invitedByUserId: string, message = '', opts?: { unlimited?: boolean }): Promise<{ id?: string; link?: string; alreadyMember?: boolean; alreadyInvited?: boolean }> => {
    const cleanEmail = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail)) throw new Error('Please enter a valid email.');

    // Already a member? (Readable by staff; for others the query degrades to "unknown".)
    const memberSnap = await getDocs(query(collection(db, 'users'), where('email', '==', cleanEmail), limit(1))).catch(() => null);
    if (memberSnap && !memberSnap.empty) return { alreadyMember: true };

    // Already invited? A duplicate costs NO invite — but the intention still flies (a second
    // invite doc + email), so the invited soul may well see two invitations. Staff see every
    // pending invite; others at least see their own.
    let alreadyInvited = false;
    const anyPending = await getDocs(query(networkInvitesCollection, where('email', '==', cleanEmail), where('status', '==', 'pending'), limit(1))).catch(() => null);
    if (anyPending) alreadyInvited = !anyPending.empty;
    else {
        const minePending = await getDocs(query(networkInvitesCollection, where('invitedByUserId', '==', invitedByUserId), where('email', '==', cleanEmail), where('status', '==', 'pending'), limit(1))).catch(() => null);
        alreadyInvited = !!minePending && !minePending.empty;
    }
    // Staff are ALWAYS unlimited, checked here rather than trusted to every caller — the
    // approve-request flow used to forget opts.unlimited and told the node owner
    // "No invites remaining".
    let unlimited = opts?.unlimited === true;
    if (!unlimited) {
        const [superadmin, adminDoc] = await Promise.all([
            getDoc(doc(db, 'config', 'superadmin')).catch(() => null),
            getDoc(doc(db, 'admins', invitedByUserId)).catch(() => null),
        ]);
        unlimited = (superadmin?.exists() && (superadmin.data() as any)?.uid === invitedByUserId) || !!adminDoc?.exists();
    }
    if (!unlimited && !alreadyInvited) {
        // Spend one of the inviter's allotment atomically (a duplicate costs nothing).
        await runTransaction(db, async (t) => {
            const ref = doc(db, 'users', invitedByUserId);
            const snap = await t.get(ref);
            if (!snap.exists()) throw new Error('User profile not found.');
            const remaining = snap.data().invitesRemaining || 0;
            if (remaining <= 0) throw new Error('No invites remaining.');
            t.update(ref, { invitesRemaining: remaining - 1 });
        });
    }
    const ref = await addDoc(networkInvitesCollection, {
        email: cleanEmail, invitedByUserId, status: 'pending', message, createdAt: serverTimestamp(),
    });
    const link = `${window.location.origin}?invite=${ref.id}`;
    try {
        await triggerSystemEmail(cleanEmail, 'You are invited to lightseed',
            `${message ? `"${message}"\n\n` : ''}You have been invited to join the lightseed network.`, invitedByUserId,
            { ctaUrl: link, ctaLabel: 'Accept your invitation' });
    } catch (e) { console.warn('Invite email failed:', e); }
    return { id: ref.id, link, alreadyInvited };
};

export const getNetworkInvite = async (inviteId: string): Promise<any | null> => {
    const snap = await getDoc(doc(db, 'networkInvites', inviteId));
    return snap.exists() ? { id: snap.id, ...(snap.data() as any) } : null;
};

const INVITE_PAGE = 12;
type Paged = { items: any[]; lastDoc: QueryDocumentSnapshot | null; hasMore: boolean };

export const getSentInvites = async (userId: string, lastDoc?: QueryDocumentSnapshot): Promise<Paged> => {
    let q = query(networkInvitesCollection, where('invitedByUserId', '==', userId), orderBy('createdAt', 'desc'), limit(INVITE_PAGE));
    if (lastDoc) q = query(q, startAfter(lastDoc));
    const snap = await getDocs(q);
    return { items: snap.docs.map(d => (mapDoc(d))), lastDoc: snap.docs[snap.docs.length - 1] || null, hasMore: snap.docs.length === INVITE_PAGE };
};

export const consumeNetworkInvite = (inviteId: string, acceptedByUserId: string) =>
    updateDoc(doc(db, 'networkInvites', inviteId), { status: 'accepted', acceptedByUserId, acceptedAt: serverTimestamp() });

// --- Invite requests (people without an invitation asking to join) ----------------
const inviteRequestsCollection = collection(db, 'inviteRequests');

export const createInviteRequest = async (email: string, reason: string) => {
    const cleanEmail = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail)) throw new Error('Please enter a valid email.');
    await addDoc(inviteRequestsCollection, {
        email: cleanEmail, reason: reason.trim(), status: 'pending', createdAt: serverTimestamp(),
    });
};

// Requests (pending + approved + declined), newest first, paginated — the admin filters the view.
export const getInviteRequests = async (lastDoc?: QueryDocumentSnapshot): Promise<Paged> => {
    let q = query(inviteRequestsCollection, orderBy('createdAt', 'desc'), limit(INVITE_PAGE));
    if (lastDoc) q = query(q, startAfter(lastDoc));
    const snap = await getDocs(q);
    return { items: snap.docs.map(d => (mapDoc(d))), lastDoc: snap.docs[snap.docs.length - 1] || null, hasMore: snap.docs.length === INVITE_PAGE };
};

// Submitting a request goes through a Cloud Function so it can (with admin rights) check
// whether a pending invitation or request already exists for that email.
// Returns one of: 'created' | 'pending_invite_exists' | 'already_requested'.
export const submitInviteRequest = async (email: string, reason: string): Promise<string> => {
    const callable = httpsCallable(functions, 'requestInvite');
    const res = await callable({ email, reason });
    return (res.data as any)?.status as string;
};

// Approve → mint a real invitation to that email and mark the request handled.
export const approveInviteRequest = async (requestId: string, adminUid: string) => {
    const reqRef = doc(db, 'inviteRequests', requestId);
    const snap = await getDoc(reqRef);
    if (!snap.exists()) throw new Error('Request not found.');
    const invite = await createNetworkInvite((snap.data() as any).email, adminUid);
    await updateDoc(reqRef, { status: 'approved', approvedBy: adminUid, approvedAt: serverTimestamp() });
    return invite;
};

export const declineInviteRequest = (requestId: string) =>
    updateDoc(doc(db, 'inviteRequests', requestId), { status: 'declined', declinedAt: serverTimestamp() });

export const logout = () => firebaseSignOut(auth);

export const listenToUserProfile = (userId: string, callback: (data: any) => void) => {
    return onSnapshot(doc(db, 'users', userId), (docSnap) => {
        if (docSnap.exists()) callback(docSnap.data());
    });
}

export const updateUserSiteTheme = (userId: string, data: { siteTheme?: Record<string, string>; siteLogoUrl?: string; siteHeroUrl?: string }) =>
    setDoc(doc(db, 'users', userId), { ...data, updatedAt: serverTimestamp() }, { merge: true });

export const updateUserProfile = (userId: string, data: Record<string, unknown>) =>
    setDoc(doc(db, 'users', userId), { ...data, updatedAt: serverTimestamp() }, { merge: true });

// Contact privacy. The canonical flag lives on users/{uid}, but we mirror it onto every
// tree the user owns because lifetrees are world-readable and the reach gate reads the
// flag straight off the target tree (no cross-user profile read required).
export const setOnlyValidatedCanReach = async (userId: string, value: boolean) => {
    await setDoc(doc(db, 'users', userId), { onlyValidatedCanReach: value, updatedAt: serverTimestamp() }, { merge: true });
    try {
        const mine = await getDocs(query(lifetreesCollection, where('ownerId', '==', userId)));
        if (!mine.empty) {
            const batch = writeBatch(db);
            mine.docs.forEach(d => batch.update(d.ref, { onlyValidatedCanReach: value }));
            await batch.commit();
        }
    } catch (e) {
        console.warn('Failed to mirror onlyValidatedCanReach onto trees', e);
    }
};

export const deleteUserAccount = async () => {
    const user = auth.currentUser;
    if (!user) throw new Error("No user signed in");
    const uid = user.uid;
    const email = user.email;

    try {
        const treesQ = query(collection(db, 'lifetrees'), where('ownerId', '==', uid));
        const treesSnap = await getDocs(treesQ);
        const batch = writeBatch(db);
        treesSnap.docs.forEach(d => batch.delete(d.ref));

        const pulsesQ = query(collection(db, 'pulses'), where('authorId', '==', uid));
        const pulsesSnap = await getDocs(pulsesQ);
        pulsesSnap.docs.forEach(d => batch.delete(d.ref));

        const visionsQ = query(collection(db, 'visions'), where('authorId', '==', uid));
        const visionsSnap = await getDocs(visionsQ);
        visionsSnap.docs.forEach(d => batch.delete(d.ref));

        const userRef = doc(db, 'users', uid);
        batch.delete(userRef);
        await batch.commit();

        if (email) await triggerSystemEmail(email, "Goodbye from lightseed", "It was wonderful to have you. See you!", uid);
        await firebaseDeleteUser(user);
    } catch (e: any) {
        if (e.code === 'auth/requires-recent-login') throw new Error("Please log out and log in again to confirm deletion security.");
        throw e;
    }
}

export const checkAndIncrementAiUsage = async (type: 'text' | 'image'): Promise<boolean> => {
    const user = auth.currentUser;
    if (!user) return false;
    const userRef = doc(db, 'users', user.uid);
    try {
        await runTransaction(db, async (t) => {
            const docSnap = await t.get(userRef);
            if (!docSnap.exists()) throw new Error("User profile missing");
            const data = docSnap.data();
            const now = Date.now();
            // Reset when the calendar day (local) differs. Comparing the full date — not just
            // getDate() (day-of-month) — so a limit hit on e.g. the 5th doesn't stay stuck until
            // the 5th of the NEXT month; any two same-numbered days a month apart used to collide.
            const isSameDay = new Date(data.lastAiReset || 0).toDateString() === new Date(now).toDateString();
            let textCount = data.dailyAiText || 0;
            let imageCount = data.dailyAiImage || 0;
            if (!isSameDay) { textCount = 0; imageCount = 0; }
            if (type === 'text') {
                if (textCount >= 21) throw new Error("Daily Oracle limit reached (21/21).");
                textCount++;
            } else {
                if (imageCount >= 3) throw new Error("Daily Vision limit reached (3/3).");
                imageCount++;
            }
            t.update(userRef, { dailyAiText: textCount, dailyAiImage: imageCount, lastAiReset: now });
        });
        return true;
    } catch (e) { throw e; }
}

export const triggerSystemEmail = async (to: string, subject: string, text: string, userId?: string, opts?: { ctaUrl?: string; ctaLabel?: string }) => {
    const effectiveUid = userId || auth.currentUser?.uid;
    if (!effectiveUid) throw new Error("User ID required for email triggering.");

    // The branded HTML shell + CTA button are composed server-side (sendSystemEmail) from this
    // plain text and an optional CTA — the client no longer sends raw HTML.
    try {
        const sendEmailFn = httpsCallable(functions, 'sendSystemEmail');
        return await sendEmailFn({ to: [to], subject, text, ctaUrl: opts?.ctaUrl, ctaLabel: opts?.ctaLabel });
    } catch (e) {
        console.error("Email trigger failed:", e);
        throw e;
    }
}

export const sendInvite = async (targetEmail: string, customMessage: string, userId: string, inviteLink: string) => {
    const userRef = doc(db, 'users', userId);
    await runTransaction(db, async (t) => {
        const userDoc = await t.get(userRef);
        if (!userDoc.exists()) throw new Error("User profile not found");
        const currentInvites = userDoc.data().invitesRemaining || 0;
        if (currentInvites <= 0) throw new Error("No invites remaining.");
        t.update(userRef, { invitesRemaining: currentInvites - 1 });
    });
    await triggerSystemEmail(targetEmail, "You have been invited to lightseed", `${customMessage ? `"${customMessage}"\n\n` : ""}You have been invited to join the lightseed network. Join here: ${inviteLink}`, userId);
}

export const monitorMailStatus = (docId: string, onChange: (status: any) => void) => {
    return onSnapshot(doc(db, 'mail', docId), (docSnap) => {
        if (docSnap.exists()) onChange(docSnap.data().delivery);
    }, (error) => {
        if (error.code === 'permission-denied') onChange({ state: 'ERROR', error: 'Permission denied' });
    });
}

const normalizeSubscriptionId = (email: string) => encodeURIComponent(email.trim().toLowerCase());

// Public newsletter signup. Uses the SAME deterministic id + normalized email + active flag as
// setNewsletterSubscription, so these subscribers are included by the newsletter send filter
// (active === true) and can be unsubscribed by the one-click endpoint (which looks up by id).
export const subscribeToNewsletter = async (email: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalizedEmail)) throw new Error('Please enter a valid email.');
    return setDoc(doc(db, 'subscriptions', normalizeSubscriptionId(normalizedEmail)), {
        email: normalizedEmail,
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    }, { merge: true });
};

export const setNewsletterSubscription = async (uid: string, email: string, subscribe: boolean) => {
    const userRef = doc(db, 'users', uid);
    const subRef = doc(db, 'subscriptions', normalizeSubscriptionId(email));
    const normalizedEmail = email.trim().toLowerCase();

    await setDoc(userRef, { newsletterSubscribed: subscribe }, { merge: true });

    if (subscribe) {
        await setDoc(subRef, {
            uid,
            email: normalizedEmail,
            active: true,
            updatedAt: serverTimestamp(),
            createdAt: serverTimestamp(),
        }, { merge: true });
    } else {
        await setDoc(subRef, {
            uid,
            email: normalizedEmail,
            active: false,
            updatedAt: serverTimestamp(),
        }, { merge: true });
    }

    try {
        await triggerSystemEmail(
            email,
            subscribe ? "Newsletter subscription confirmed" : "Newsletter unsubscribed",
            subscribe
                ? "You are now subscribed to the lightseed newsletter. We will send you updates from the network."
                : "You have been unsubscribed from the lightseed newsletter. You can subscribe again anytime from your profile.",
            uid
        );
    } catch (e) {
        console.warn('Newsletter confirmation email failed', e);
    }
};

const fetchNewsletterChanges = async <T>(collectionRef: any, lastSentAt: Timestamp | null, mapper: (doc: any) => T) => {
    const q = lastSentAt
        ? query(collectionRef, where('createdAt', '>', lastSentAt), orderBy('createdAt', 'desc'), limit(8))
        : query(collectionRef, orderBy('createdAt', 'desc'), limit(8));

    const snap = await getDocs(q);
    return snap.docs.map(mapper);
};

export const getNewsletterDraftData = async () => {
    let lastSentAt = null;
    try {
        const configSnap = await getDoc(newsletterConfigRef);
        lastSentAt = (configSnap.exists() ? (configSnap.data() as any).lastSentAt : null) || null;
    } catch (e) {
        console.warn('Newsletter config read skipped', e);
    }

    const [trees, visions, pulses] = await Promise.all([
        fetchNewsletterChanges(lifetreesCollection, lastSentAt, (d) => (mapDoc(d) as Lifetree)),
        fetchNewsletterChanges(visionsCollection, lastSentAt, (d) => (mapDoc(d) as Vision)),
        fetchNewsletterChanges(pulsesCollection, lastSentAt, (d) => (mapDoc(d) as Pulse)),
    ]);

    return { lastSentAt, trees, visions, pulses };
};

// Newsletter — sent server-side through Resend (batched, with one-click unsubscribe + footer),
// so it scales and is compliant. The Cloud Function gates to staff and stamps config/newsletter.
export const sendNewsletter = async ({ subject, html }: { subject: string; html: string; senderUid?: string }) => {
    const fn = httpsCallable(functions, 'sendNewsletterEmails');
    const res = await fn({ subject, html });
    return (res.data as any)?.sent ?? 0;
};

// Admin: delete a user (their data + Auth record) via a staff-only Cloud Function. Handy for
// re-testing onboarding. Returns the per-collection counts removed.
export const deleteUserAsAdmin = async (uid: string): Promise<{ deleted: boolean }> => {
    const fn = httpsCallable(functions, 'deleteUserAsAdmin');
    const res = await fn({ uid });
    return res.data as { deleted: boolean };
};

export type AdminUserRow = { uid: string; email: string | null; displayName: string; createdAt: number | null; isSuperAdmin: boolean };

// Admin: browse users (staff-only Cloud Function) — the roster behind the deletion tool.
export const listUsersAsAdmin = async (): Promise<AdminUserRow[]> => {
    const fn = httpsCallable(functions, 'listUsersAsAdmin');
    const res = await fn({});
    return ((res.data as any)?.users || []) as AdminUserRow[];
};

