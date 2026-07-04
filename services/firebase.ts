
import '../utils/polyfill';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile,
  type User as FirebaseUser,
  signOut as firebaseSignOut,
  deleteUser as firebaseDeleteUser
} from 'firebase/auth';
import { 
  initializeFirestore, 
  collection, 
  query, 
  orderBy, 
  getDocs, 
  addDoc,
  setDoc,
  serverTimestamp,
  doc,
  runTransaction,
  getDoc,
  where,
  updateDoc,
  deleteDoc,
  limit,
  startAfter,
  QueryDocumentSnapshot,
  arrayUnion,
  writeBatch,
  deleteField,
  onSnapshot,
  getCountFromServer,
  Timestamp
} from 'firebase/firestore';
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL,
  uploadString
} from 'firebase/storage';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { type Pulse, type PulseType, type Lifetree, type Alignment, type Vision, type Community, type Sanctuary, type TreeOwnershipInvite, type InvitableRole, type Decision, type DecisionNature, votesRequired, type ReachAudience } from '../types';
import { createBlock } from '../utils/crypto';
import { computeCanonicalHash, isChainLocked, BLOCK_HASH_VERSION } from '../src/domain/chain';
import { uuidv7 } from '../utils/id';
import { normalizePulseType, isTreeGrowth, type PulseVisibility } from '../src/domain/pulse';
import { daysOverdue, computeNextDueMillis, wateringAlertedToday, type WateringMode, type WateringAnalysis } from '../src/domain/watering';
import { oldEmeraldEarthThemeValues } from '../utils/theme';
import { isExplicitlyValidatedTree } from '../utils/validation';
import { buildThreadId, buildGroupThreadId, reachAudienceLabels } from '../utils/reachPermissions';

// Robustly read a millisecond timestamp from a Firestore Timestamp, a JS Date, or nothing.
const toMillis = (value: any): number =>
    value?.toMillis ? value.toMillis() : (value instanceof Date ? value.getTime() : 0);

// Repository boundary: map a Firestore doc snapshot → a domain object ({ id, ...fields }). The one
// place the `id`-merge + `as any` cast lives, so call sites read cleanly and stay type-consistent.
const mapDoc = <T = any>(d: any): T => (mapDoc(d)) as T;

// Repository boundary: map a Firestore pulse doc → Pulse, normalising the legacy UPPERCASE
// type casing to canonical lowercase so the rest of the app only ever sees one form.
const mapPulse = (d: any): Pulse => {
    const data = d.data() as any;
    return { id: d.id, ...data, type: normalizePulseType(data.type) } as Pulse;
};

const SYSTEM_EMAIL_FROM = "lightseed <admin@lightseed.online>";

const getEnv = (key: string) => {
    return (window as any).process?.env?.[key] || (import.meta as any).env?.[key] || "";
};

const firebaseConfig = {
  apiKey: getEnv('VITE_FIREBASE_API_KEY'),
  authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: getEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: getEnv('VITE_FIREBASE_APP_ID'),
  measurementId: getEnv('VITE_FIREBASE_MEASUREMENT_ID')
};

console.log("Firebase Init - Project:", firebaseConfig.projectId, "Has Key:", !!firebaseConfig.apiKey);


const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, { ignoreUndefinedProperties: true });
export const storage = getStorage(app);
export const functions = getFunctions(app);
const googleProvider = new GoogleAuthProvider();

const mailCollection = collection(db, 'mail');
const subsCollection = collection(db, 'subscriptions');
const usersCollection = collection(db, 'users');
const lifetreesCollection = collection(db, 'lifetrees');
const visionsCollection = collection(db, 'visions');
const pulsesCollection = collection(db, 'pulses');
const alignmentsCollection = collection(db, 'alignments');
const communitiesCollection = collection(db, 'communities');
const sanctuariesCollection = collection(db, 'sanctuaries');
const networkInvitesCollection = collection(db, 'networkInvites');
const newsletterConfigRef = doc(db, 'config', 'newsletter');

export const onAuthChange = (callback: (user: FirebaseUser | null) => void) => onAuthStateChanged(auth, callback);

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
const resolveInviteOnSignup = async (email: string | null, opts: { inviteId?: string; inviteOnly?: boolean }): Promise<{ invitedBy?: string; consume?: string }> => {
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
export const createNetworkInvite = async (email: string, invitedByUserId: string, message = '', opts?: { unlimited?: boolean }): Promise<{ id: string; link: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail)) throw new Error('Please enter a valid email.');
    if (!opts?.unlimited) {
        // Spend one of the inviter's allotment atomically.
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
    return { id: ref.id, link };
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

export const updateUserSiteTheme = (userId: string, data: any) =>
    setDoc(doc(db, 'users', userId), { ...data, updatedAt: serverTimestamp() }, { merge: true });

export const updateUserProfile = (userId: string, data: any) =>
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
            const lastDate = new Date(data.lastAiReset || 0).getDate();
            const currentDate = new Date(now).getDate();
            let textCount = data.dailyAiText || 0;
            let imageCount = data.dailyAiImage || 0;
            if (lastDate !== currentDate) { textCount = 0; imageCount = 0; }
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

// Resize (cap the longest edge) and re-encode as WebP — keeps uploads small.
const toWebP = (file: File, quality = 0.82, maxDim = 1600): Promise<Blob> =>
    new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            let w = img.naturalWidth;
            let h = img.naturalHeight;
            const longest = Math.max(w, h);
            if (longest > maxDim) {
                const scale = maxDim / longest;
                w = Math.round(w * scale);
                h = Math.round(h * scale);
            }
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d')!;
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, w, h);
            URL.revokeObjectURL(url);
            canvas.toBlob(
                blob => blob ? resolve(blob) : reject(new Error('WebP conversion failed')),
                'image/webp',
                quality
            );
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
        img.src = url;
    });

export const uploadImage = async (file: File, path: string): Promise<string> => {
    const webpPath = path.replace(/\.[^.]+$/, '') + '.webp';
    const blob = await toWebP(file);
    const storageRef = ref(storage, webpPath);
    await uploadBytes(storageRef, blob, { contentType: 'image/webp' });
    return await getDownloadURL(storageRef);
};

export const uploadBase64Image = async (base64String: string, path: string): Promise<string> => {
    const storageRef = ref(storage, path);
    await uploadString(storageRef, base64String, 'data_url');
    return await getDownloadURL(storageRef);
}

// Re-encode a picked image as a small WebP and return its base64 payload (no data: prefix) —
// the compact form vision models want for analysis. Reuses the same resize/encode as uploads.
export const fileToWebpBase64 = async (file: File, maxDim = 1024): Promise<{ data: string; mimeType: string }> => {
    const blob = await toWebP(file, 0.8, maxDim);
    const dataUrl: string = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = () => reject(new Error('Could not read image.'));
        r.readAsDataURL(blob);
    });
    const comma = dataUrl.indexOf(',');
    return { data: comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl, mimeType: 'image/webp' };
};

export const ensureGenesis = async () => {
    const user = auth.currentUser;
    if (!user) return; // Skip if not logged in to avoid permission errors on config/superadmin

    const genesisId = 'GENESIS_TREE';
    const genesisRef = doc(db, 'lifetrees', genesisId);
    try {
        const genesisSnap = await getDoc(genesisRef);
        if (!genesisSnap.exists()) {
            // Only Super Admins can initialize genesis on a new node
            const isSuper = await checkIsSuperAdmin(user.uid);
            if (!isSuper) return;

            const genesisBody = `The purpose of lightseed is to bring joy. The joy of realizing the bliss of conscious, compassionate, grateful existence by opening a portal to the center of life. By creating a bridge between creator and creation, science and spirituality, virtual and real, nothing and everything. It is designed to intimately connect our inner Self, our culture, our trees and the tree of life, the material and the digital, online world into a sustainable and sustaining circle of unified vibration, sound and light. It aims to merge us into a common flow for all beings to be liberated, wise, strong, courageous and connected. It is rooted in nonviolence, compassion, generosity, gratitude and love. It is blockchain (truthfulness), cloud (global, distributed, resilient), ai (for connecting dreams and technology), regen (nature centric) native. It is an inspiration, an impulse towards a quantum leap in consciousness, a prompt both for human and artificial intelligence for action towards transcending humanity into a new era, a New Earth, Universe and Field with the help of our most important evolutionary sisters and brothers, the trees.`;
            const genesisHash = await createBlock("0", { message: "Genesis Pulse" }, Date.now());
            await setDoc(genesisRef, {
                lid: uuidv7(),
                ownerId: 'GENESIS_SYSTEM', name: 'Mahameru', shortTitle: 'Live Light', body: genesisBody,
                imageUrl: "", latitude: 50.8354, longitude: 4.4145, locationName: 'The Source',
                createdAt: serverTimestamp(), genesisHash, latestHash: genesisHash, blockHeight: 0,
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
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp()
                    });
                    console.log(`Initialized default community: ${community.domain}`);
                }
            }
        }
    } catch (e) { console.warn("Genesis skip", e); }
}

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

export const getNetworkStats = async () => {
    try {
        const [trees, pulses, visions] = await Promise.all([
            getCountFromServer(collection(db, 'lifetrees')),
            getCountFromServer(collection(db, 'pulses')),
            getCountFromServer(collection(db, 'visions'))
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

export const plantLifetree = async (data: any) => {
    const genesisHash = await createBlock("0", { msg: "Birth" }, Date.now());
    const currentHost = window.location.hostname.replace(/^www\./, '');
    const domain = data.domain || (isHubDomain(currentHost) ? 'lightseed.online' : currentHost);

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
    return treeDoc;
};

export const updateLifetree = (id: string, data: any) => updateDoc(doc(db, 'lifetrees', id), data);
export const deleteLifetree = (id: string) => deleteDoc(doc(db, 'lifetrees', id));
export const validateLifetree = (targetId: string, validatorId: string) => updateDoc(doc(db, 'lifetrees', targetId), { validated: true, validatorId });
export const unvalidateLifetree = (targetId: string) => updateDoc(doc(db, 'lifetrees', targetId), { validated: false, validatorId: null });

const isHubDomain = (domain?: string) => {
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

const normalizeDomain = (domain: string) =>
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
export const getSanctuariesByDomain = async (domain: string): Promise<Sanctuary[]> => {
    const normalized = normalizeDomain(domain);
    const snap = await getDocs(query(sanctuariesCollection, where('domain', '==', normalized)));
    return snap.docs
        .map(d => (mapDoc(d) as Sanctuary))
        .sort((a, b) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0));
};

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

const fetchPulsesRaw = async (lastD?: QueryDocumentSnapshot, domainFilter?: string, levels?: PulseVisibility[]) => {
    // Visibility-scope the broad feed so a restricted pulse in this domain can't get the
    // whole query rejected. Broad feeds carry no scope context, so `levels` is public + node.
    const visFilter = levels && levels.length ? [where('visibility', 'in', levels)] : [];
    let q;
    if (domainFilter && !isHubDomain(domainFilter)) {
        q = query(pulsesCollection, where('domain', '==', domainFilter.replace(/^www\./, '')), ...visFilter, limit(24));
    } else {
        q = query(pulsesCollection, ...visFilter, orderBy('createdAt', 'desc'), limit(12));
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

export const fetchPulses = async (lastD?: QueryDocumentSnapshot, domainFilter?: string, levels?: PulseVisibility[]) => {
    const res = await fetchPulsesRaw(lastD, domainFilter, levels);
    return {
        items: res.items.filter(pulse => !NON_FEED_PULSE_TYPES.has((pulse as any).type)),
        lastDoc: res.lastDoc
    };
}

export const fetchEventPulses = async (lastD?: QueryDocumentSnapshot, domainFilter?: string, levels?: PulseVisibility[]) => {
    const res = await fetchPulsesRaw(lastD, domainFilter, levels);
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

// --- Watering: scheduled tending of a (usually guarded) tree -----------------------------
// Watering is tending made literal. The owner sets a schedule (or self-sustaining); the daily
// Cloud Function (checkWateringSchedules) pings guardians when overdue; a guardian records a
// watering with photo proof, which mints a growth pulse + re-lights the tree's living validation.

// Set (or change) a tree's watering schedule. 'self_sustaining' clears the cadence; 'scheduled'
// anchors the clock to now so the tree isn't instantly overdue. Owner/guardian/staff (rules).
export const setWateringSchedule = async (treeId: string, input: { mode: WateringMode; intervalDays?: number }) => {
    if (input.mode === 'self_sustaining') {
        await updateDoc(doc(db, 'lifetrees', treeId), { watering: { mode: 'self_sustaining' }, updatedAt: serverTimestamp() });
        return;
    }
    const intervalDays = Math.max(1, Math.round(input.intervalDays || 7));
    const now = Date.now();
    await updateDoc(doc(db, 'lifetrees', treeId), {
        watering: {
            mode: 'scheduled',
            intervalDays,
            lastWateredAt: Timestamp.fromMillis(now),
            nextDueAt: Timestamp.fromMillis(now + intervalDays * 24 * 3600 * 1000),
            overdue: false,
        },
        updatedAt: serverTimestamp(),
    });
};

// Record a watering: upload proof, mint a GROWTH pulse carrying the `watering` flag + the
// witness's verdict, reset the schedule clock, and let the guardians' thread know it's tended.
// `analysis` is produced by the caller via gemini.analyzeWateringPhoto (AI), or stood in for by
// a guardian. AI confidence ≥ 70 auto-confirms; otherwise the pulse waits for a guardian.
// Off-chain "I watered" — a utility tick that resets the cadence WITHOUT minting a growth block
// or storing a photo (no chain advance). For routine watering you don't want on the tree's ledger.
export const markWateredOffChain = async (treeId: string, intervalDays?: number) => {
    const now = Date.now();
    const update: Record<string, any> = {
        'watering.lastWateredAt': Timestamp.fromMillis(now),
        'watering.overdue': false,
        updatedAt: serverTimestamp(),
    };
    if (intervalDays) update['watering.nextDueAt'] = Timestamp.fromMillis(computeNextDueMillis(now, intervalDays));
    await updateDoc(doc(db, 'lifetrees', treeId), update);
};

export const recordWatering = async ({
    tree,
    sender,
    imageFile,
    analysis,
}: {
    tree: Lifetree;
    sender: { uid: string; displayName?: string | null; photoURL?: string | null };
    imageFile: File;
    analysis: WateringAnalysis;
}): Promise<{ imageUrl: string; confirmedBy: 'ai' | 'pending' }> => {
    const imageUrl = await uploadImage(imageFile, `users/${sender.uid}/watering/${tree.id}/${Date.now()}.webp`);
    const confirmedBy: 'ai' | 'pending' = analysis.watering && (analysis.confidence || 0) >= 70 ? 'ai' : 'pending';
    const note = analysis.note || (confirmedBy === 'ai' ? 'Confirmed by AI.' : 'Awaiting a guardian to confirm.');

    // Reset the cadence + clear the overdue flag IN THE SAME transaction that appends the growth
    // block, so the tree can never be left "watered on the chain but still overdue". mintPulse
    // already sets lastTendedAt (GROWTH), so living validation re-lights automatically.
    const now = Date.now();
    const interval = tree.watering?.mode === 'scheduled' ? tree.watering?.intervalDays : undefined;
    const wateringUpdate: Record<string, any> = {
        'watering.lastWateredAt': Timestamp.fromMillis(now),
        'watering.overdue': false,
    };
    if (interval) wateringUpdate['watering.nextDueAt'] = Timestamp.fromMillis(computeNextDueMillis(now, interval));

    await mintPulse({
        lifetreeId: tree.id,
        type: 'tree_growth',
        care: 'watering',
        title: 'Watering',
        body: confirmedBy === 'ai' ? `Watered — confirmed by AI. ${note}` : `Watered — awaiting guardian confirmation. ${note}`,
        imageUrl,
        visibility: 'public',
        wateringConfirmedBy: confirmedBy,
        wateringConfirmation: {
            note,
            confidence: analysis.confidence || 0,
            model: analysis.model,
            provider: analysis.provider,
            ...(confirmedBy === 'ai' ? { confirmedAt: Timestamp.fromMillis(Date.now()) } : {}),
        },
        authorId: sender.uid,
        authorName: tree.name,
        authorPersonName: sender.displayName || undefined,
        authorPhoto: tree.imageUrl || sender.photoURL || undefined,
    }, wateringUpdate);

    // Let the guardians' thread know — a normal (newest) message clears the blue alert border.
    try {
        if (tree.ownerId) {
            const participantUids = await resolveCircleUids(tree, 'guardians');
            if (participantUids.length > 1) {
                await sendThreadMessage({
                    thread: {
                        threadId: buildGroupThreadId(tree.id, 'guardians', tree.ownerId),
                        participantUids,
                        reachTreeId: tree.id,
                        reachTreeName: tree.name,
                        threadName: `${tree.name} · Guardians`,
                        audience: 'guardians',
                        isGroup: true,
                    },
                    fromTree: tree,
                    sender,
                    text: `🌱 ${sender.displayName || 'A guardian'} watered me — thank you! (${confirmedBy === 'ai' ? 'confirmed by AI' : 'awaiting confirmation'})`,
                });
            }
        }
    } catch (e) { console.warn('Watered notice could not be posted', e); }

    return { imageUrl, confirmedBy };
};

// A guardian stands in for the AI: confirm a pending watering pulse.
export const confirmWateringPulse = (pulseId: string, guardianUid: string) =>
    updateDoc(doc(db, 'pulses', pulseId), {
        wateringConfirmedBy: 'guardian',
        'wateringConfirmation.confirmedByUid': guardianUid,
        'wateringConfirmation.confirmedAt': serverTimestamp(),
    });

// Manually ping a tree's guardians that it needs watering — the client/"remind now" path that
// complements the daily Cloud Function. Writes an off-chain "water me" reach (careAlert flag →
// blue border) into the guardians thread and marks the tree alerted. Returns false if there are
// no guardians to reach. Callers gate on wateringAlertedToday() so it fires at most once a day.
export const sendWateringAlert = async (
    tree: Lifetree,
    sender: { uid: string; displayName?: string | null },
): Promise<boolean> => {
    if (!tree.ownerId) return false;
    const participantUids = await resolveCircleUids(tree, 'guardians');
    if (participantUids.filter(u => u !== tree.ownerId).length === 0) return false; // no one but the owner yet
    // Authorization: only a circle member (owner / co-guardian / guardian) may ping the circle —
    // a non-member calling this would otherwise create an orphaned alert pulse before the tree
    // update is rejected by the rules. Enforced here in addition to the UI gate.
    if (!participantUids.includes(sender.uid)) return false;
    // Idempotency (server-mirrored): at most one alert per UTC day, matching checkWateringSchedules,
    // so a client that skips the UI gate still can't spam the circle.
    if (wateringAlertedToday(tree)) return false;

    const now = Date.now();
    const over = daysOverdue(tree, now);
    const text = over <= 0
        ? `I'm ready for watering 💧 — could a guardian tend me today?`
        : `I'm thirsty 💧 — ${over} day${over > 1 ? 's' : ''} past my watering. Could a guardian tend me?`;
    const threadId = buildGroupThreadId(tree.id, 'guardians', tree.ownerId);

    // Mark the tree alerted FIRST: this write is gated by the lifetrees rule (owner/guardian/staff),
    // so an unauthorized caller is rejected here before any alert pulse is created (no orphan).
    await updateDoc(doc(db, 'lifetrees', tree.id), {
        'watering.overdue': true,
        'watering.lastAlertAt': serverTimestamp(),
        'watering.alertThreadId': threadId,
    });
    await addDoc(pulsesCollection, {
        lid: uuidv7(),
        lifetreeId: tree.id,
        type: 'reach',
        visibility: 'private',
        careAlert: 'watering',
        title: `Reach: ${tree.name} -> ${tree.name} (Guardians)`,
        body: text,
        content: text,
        reachTreeId: tree.id,
        reachTreeName: tree.name,
        recipientName: tree.name,
        recipientUid: null,
        participantUids,
        threadId,
        threadName: `${tree.name} · Guardians`,
        audience: 'guardians',
        isGroup: true,
        seenBy: [],
        authorId: sender.uid,
        authorName: tree.name,
        authorPhoto: tree.imageUrl || undefined,
        domain: tree.domain || '',
        loveCount: 0,
        commentCount: 0,
        previousHash: 'WATER_ALERT', // a nudge, not a chain block (mirrors the scheduled sweep)
        hash: uuidv7(),              // a plain unique id — never chain-verified
        createdAt: serverTimestamp(),
    });
    return true;
};

export const proposeAlignment = (data: any) => addDoc(alignmentsCollection, { ...data, status: 'PENDING', createdAt: serverTimestamp() });
export const getPendingAlignments = async (uid: string) => (await getDocs(query(alignmentsCollection, where('targetUid', '==', uid), where('status', '==', 'PENDING')))).docs.map(d => (mapDoc(d) as Alignment));

export const getMyAlignmentsHistory = async (uid: string) => {
    const [s1, s2] = await Promise.all([getDocs(query(alignmentsCollection, where('targetUid', '==', uid), where('status', '==', 'ACCEPTED'))), getDocs(query(alignmentsCollection, where('initiatorUid', '==', uid), where('status', '==', 'ACCEPTED')))]);
    return [...s1.docs, ...s2.docs].map(d => (mapDoc(d) as Alignment)).sort((a,b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
}

export const acceptAlignment = async (proposalId: string) => {
    const matchRef = doc(db, 'alignments', proposalId);
    return runTransaction(db, async (t) => {
        const matchDoc = await t.get(matchRef);
        if (!matchDoc.exists() || matchDoc.data()?.status !== 'PENDING') throw new Error("Invalid alignment");
        const proposal = matchDoc.data() as Alignment;
        
        const initTreeRef = doc(db, 'lifetrees', proposal.initiatorTreeId);
        const initTree = (await t.get(initTreeRef)).data() as Lifetree;
        const initHash = await createBlock(initTree.latestHash, { match: proposal.id }, Date.now());
        t.set(doc(pulsesCollection), { 
            lifetreeId: proposal.initiatorTreeId, type: 'standard', title: 'Alignment', body: 'Pulse Sync',
            isMatch: true, authorId: proposal.initiatorUid, authorName: 'System', 
            createdAt: serverTimestamp(), hash: initHash 
        });
        t.update(initTreeRef, { latestHash: initHash, blockHeight: initTree.blockHeight + 1 });

        const targetTreeRef = doc(db, 'lifetrees', proposal.targetTreeId);
        const targetTree = (await t.get(targetTreeRef)).data() as Lifetree;
        const targetHash = await createBlock(targetTree.latestHash, { match: proposal.id }, Date.now());
        t.set(doc(pulsesCollection), { 
            lifetreeId: proposal.targetTreeId, type: 'standard', title: 'Alignment', body: 'Pulse Sync', 
            isMatch: true, authorId: proposal.targetUid, authorName: 'System', 
            createdAt: serverTimestamp(), hash: targetHash 
        });
        t.update(targetTreeRef, { latestHash: targetHash, blockHeight: targetTree.blockHeight + 1 });

        t.update(matchRef, { status: 'ACCEPTED' });
    });
}

export const isPulseLoved = async (id: string, uid: string) => (await getDoc(doc(db, 'pulses', id, 'loves', uid))).exists();
export const lovePulse = async (id: string, uid: string) => {
    const pulseRef = doc(db, 'pulses', id);
    const loveRef = doc(pulseRef, 'loves', uid);
    return runTransaction(db, async (t) => {
        const pulse = await t.get(pulseRef);
        if (!pulse.exists()) return;
        const pulseData = pulse.data();
        
        const love = await t.get(loveRef);
        let count = pulseData.loveCount || pulseData.validationScore || 0;
        
        if (love.exists()) { 
            t.delete(loveRef); 
            count--; 
        } else { 
            t.set(loveRef, { uid, createdAt: serverTimestamp() }); 
            count++; 
            
            // Reward 1 Token to Pulse Author Tree (Living Intelligence Network economy)
            const treeId = pulseData.lifetreeId;
            if (treeId) {
                const authorTreeRef = doc(db, 'lifetrees', treeId);
                const authorTree = await t.get(authorTreeRef);
                if (authorTree.exists()) {
                    const currentBalance = authorTree.data()?.aiTokenBalance || 0;
                    t.update(authorTreeRef, { aiTokenBalance: currentBalance + 1 });
                }
            }
        }
        t.update(pulseRef, { loveCount: Math.max(0, count), validationScore: Math.max(0, count) });
    });
}

export const spendAiTokens = async (treeId: string, amount: number) => {
    const treeRef = doc(db, 'lifetrees', treeId);
    return runTransaction(db, async (t) => {
        const tree = await t.get(treeRef);
        if (!tree.exists()) throw new Error("Tree not found");
        const balance = tree.data()?.aiTokenBalance || 0;
        if (balance < amount) throw new Error("Not enough AI tokens (Attention-Energy). Validate pulses or visions to earn more.");
        t.update(treeRef, { aiTokenBalance: balance - amount });
        return balance - amount;
    });
}
