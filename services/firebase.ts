
import '../utils/polyfill';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
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
  arrayRemove,
  writeBatch,
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
import { type Pulse, type PulseType, type Lifetree, type Alignment, type Vision, type Community } from '../types';
import { createBlock } from '../utils/crypto';
import { oldEmeraldEarthThemeValues } from '../utils/theme';
import { isExplicitlyValidatedTree } from '../utils/validation';
import { buildThreadId } from '../utils/reachPermissions';

// Robustly read a millisecond timestamp from a Firestore Timestamp, a JS Date, or nothing.
const toMillis = (value: any): number =>
    value?.toMillis ? value.toMillis() : (value instanceof Date ? value.getTime() : 0);

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
const newsletterConfigRef = doc(db, 'config', 'newsletter');

export const onAuthChange = (callback: (user: FirebaseUser | null) => void) => onAuthStateChanged(auth, callback);

export const signInWithGoogle = async () => {
  try { 
      googleProvider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const userDocRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userDocRef);
      
      if (!userSnap.exists()) {
          await setDoc(userDocRef, {
              uid: user.uid,
              email: user.email,
              displayName: user.displayName,
              createdAt: serverTimestamp(),
              newsletterSubscribed: false,
              // Direct-message email notifications are on by default for new users
              // (early network — don't let people miss incoming reaches).
              emailNotifications: { directMessages: true },
              invitesRemaining: 7,
              dailyAiText: 0,
              dailyAiImage: 0,
              lastAiReset: Date.now()
          });

          // Welcome email - optional to prevent failure on dev/localhost
          try {
              await triggerSystemEmail(
                  user.email || "", 
                  "Welcome to lightseed", 
                  `Welcome to lightseed, ${user.displayName}. You have planted your intention. Now you may plant your tree.`,
                  user.uid
              );
          } catch (emailError) {
              console.warn("Welcome email could not be sent:", emailError);
          }
      }
      return user; 
  } catch (error: any) { 
      console.error("Login Failed:", error); 
      alert("Sign-in failed: " + (error.message || "Unknown error"));
      throw error; 
  }
};

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

export const triggerSystemEmail = async (to: string, subject: string, text: string, userId?: string) => {
    const effectiveUid = userId || auth.currentUser?.uid;
    if (!effectiveUid) throw new Error("User ID required for email triggering.");
    
    try {
        const sendEmailFn = httpsCallable(functions, 'sendSystemEmail');
        return await sendEmailFn({
            to: [to],
            subject: subject,
            text: text,
            html: `<div style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;"><h2 style="color: #059669; font-weight: 300; letter-spacing: 1px; margin-bottom: 20px;">.seed</h2><div style="font-size: 16px; margin-bottom: 30px;">${text.replace(/\n/g, '<br>')}</div><hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" /><p style="font-size: 12px; color: #9ca3af; text-align: center;">Sent from the <a href="https://lightseed.online" style="color: #059669; text-decoration: none;">Lifetree Network</a></p></div>`
        });
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

export const subscribeToNewsletter = async (email: string) => addDoc(subsCollection, { email, createdAt: serverTimestamp() });

const normalizeSubscriptionId = (email: string) => encodeURIComponent(email.trim().toLowerCase());

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
        fetchNewsletterChanges(lifetreesCollection, lastSentAt, (d) => ({ id: d.id, ...(d.data() as any) } as Lifetree)),
        fetchNewsletterChanges(visionsCollection, lastSentAt, (d) => ({ id: d.id, ...(d.data() as any) } as Vision)),
        fetchNewsletterChanges(pulsesCollection, lastSentAt, (d) => ({ id: d.id, ...(d.data() as any) } as Pulse)),
    ]);

    return { lastSentAt, trees, visions, pulses };
};

export const sendNewsletter = async ({ subject, html, senderUid }: { subject: string; html: string; senderUid: string }) => {
    const activeSubs = await getDocs(subsCollection);
    const recipients = activeSubs.docs
        .map(d => d.data() as any)
        .filter(sub => sub.email && sub.active === true)
        .map(sub => sub.email as string);

    if (recipients.length === 0) throw new Error("No newsletter subscribers found.");

    const sendEmailFn = httpsCallable(functions, 'sendSystemEmail');
    
    // We send emails in parallel using the Cloud Function
    await Promise.all(recipients.map((email) =>
        sendEmailFn({
            to: [email],
            subject,
            text: "This newsletter contains HTML content.",
            html,
        })
    ));

    await setDoc(newsletterConfigRef, {
        lastSentAt: serverTimestamp(),
        lastSubject: subject,
    }, { merge: true });

    return recipients.length;
};

const toWebP = (file: File, quality = 0.85): Promise<Blob> =>
    new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            canvas.getContext('2d')!.drawImage(img, 0, 0);
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
                ownerId: 'GENESIS_SYSTEM', name: 'Mahameru', shortTitle: 'Live Light', body: genesisBody,
                imageUrl: "", latitude: 50.8354, longitude: 4.4145, locationName: 'The Source',
                createdAt: serverTimestamp(), genesisHash, latestHash: genesisHash, blockHeight: 0,
                validated: true, validatorId: 'SYSTEM', isNature: true, domain: 'lightseed.online'
            });
            await setDoc(doc(db, 'visions', 'GENESIS_VISION'), {
                lifetreeId: genesisId, authorId: 'GENESIS_SYSTEM', title: "Mahameru", body: genesisBody, createdAt: serverTimestamp(), joinedUserIds: [], domain: 'lightseed.online'
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
        domain,
        onlyValidatedCanReach,
        treeType: data.treeType || (data.isNature ? 'GUARDED' : 'LIFETREE'),
        createdAt: serverTimestamp(), genesisHash, latestHash: genesisHash, blockHeight: 0,
        validated: false, validatorId: null, guardians: [], status: 'HEALTHY'
    });
    await addDoc(visionsCollection, {
        lifetreeId: treeDoc.id, authorId: data.ownerId, title: "Root Vision", body: data.body, createdAt: serverTimestamp(), joinedUserIds: [], domain
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

export const fetchLifetrees = async (lastD?: QueryDocumentSnapshot, domainFilter?: string, ownerUid?: string) => {
    const communityScoped = !!(domainFilter && !isHubDomain(domainFilter));
    let q;
    if (communityScoped) {
        // Community View: narrow to the community's domain (remove orderBy to avoid composite index)
        q = query(lifetreesCollection, where('domain', '==', domainFilter!.replace(/^www\./, '')), limit(24));
    } else {
        q = query(lifetreesCollection, orderBy('createdAt', 'desc'), limit(12));
    }

    if (lastD) q = query(q, startAfter(lastD));
    const snap = await getDocs(q);
    let items = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as Lifetree));

    if (communityScoped) {
        // The creator always sees their own trees on a community/custom domain,
        // even if those trees point at a different domain. Merge on the first page.
        if (ownerUid && !lastD) {
            const mine = await getDocs(query(lifetreesCollection, where('ownerId', '==', ownerUid)));
            const seen = new Set(items.map(t => t.id));
            mine.docs.forEach(d => {
                if (!seen.has(d.id)) items.push({ id: d.id, ...(d.data() as any) } as Lifetree);
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
export const fetchAllLifetrees = async (domainFilter?: string, ownerUid?: string): Promise<Lifetree[]> => {
    const communityScoped = !!(domainFilter && !isHubDomain(domainFilter));
    const byId = new Map<string, Lifetree>();
    const add = (d: any) => byId.set(d.id, { id: d.id, ...(d.data() as any) } as Lifetree);

    if (communityScoped) {
        (await getDocs(query(lifetreesCollection, where('domain', '==', domainFilter!.replace(/^www\./, ''))))).docs.forEach(add);
    } else {
        (await getDocs(query(lifetreesCollection, orderBy('createdAt', 'desc'), limit(1000)))).docs.forEach(add);
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

export const getMyLifetrees = async (uid: string) => (await getDocs(query(lifetreesCollection, where('ownerId', '==', uid)))).docs.map(d => ({ id: d.id, ...(d.data() as any) } as Lifetree));

const normalizeDomain = (domain: string) =>
    domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');

export const getTreesByDomain = async (domain: string, ownerUid?: string): Promise<Lifetree[]> => {
    const normalized = normalizeDomain(domain);
    // No orderBy — avoids requiring a composite Firestore index
    const q = query(lifetreesCollection, where('domain', '==', normalized));
    const snap = await getDocs(q);
    const byId = new Map<string, Lifetree>();
    snap.docs.forEach(d => byId.set(d.id, { id: d.id, ...(d.data() as any) } as Lifetree));

    // The creator always sees their own trees here, even if they pointed a tree
    // at a different domain than this community.
    if (ownerUid) {
        const mine = await getDocs(query(lifetreesCollection, where('ownerId', '==', ownerUid)));
        mine.docs.forEach(d => byId.set(d.id, { id: d.id, ...(d.data() as any) } as Lifetree));
    }

    return Array.from(byId.values());
};
export const checkIsAdmin = async (uid: string): Promise<boolean> => (await getDoc(doc(db, 'admins', uid))).exists();

export const getSuperAdminUid = async (): Promise<string | null> => {
    const snap = await getDoc(doc(db, 'config', 'superadmin'));
    return snap.exists() ? (snap.data() as any).uid : null;
};
export const checkIsSuperAdmin = async (uid: string): Promise<boolean> => (await getSuperAdminUid()) === uid;
export const claimSuperAdmin = async (uid: string): Promise<boolean> => {
    const ref = doc(db, 'config', 'superadmin');
    if ((await getDoc(ref)).exists()) return false;
    await setDoc(ref, { uid, claimedAt: serverTimestamp() });
    return true;
};
export const grantAdmin = (uid: string) => setDoc(doc(db, 'admins', uid), { grantedAt: serverTimestamp() });
export const revokeAdmin = (uid: string) => deleteDoc(doc(db, 'admins', uid));
export const getAdmins = async (): Promise<{ uid: string }[]> =>
    (await getDocs(collection(db, 'admins'))).docs.map(d => ({ uid: d.id }));
export const getGuardedTrees = async (uid: string) => (await getDocs(query(lifetreesCollection, where('guardians', 'array-contains', uid)))).docs.map(d => ({ id: d.id, ...(d.data() as any) } as Lifetree));
export const toggleGuardianship = (id: string, uid: string, join: boolean) => updateDoc(doc(db, 'lifetrees', id), { guardians: join ? arrayUnion(uid) : arrayRemove(uid) });
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
    let items = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as Vision));
    
    if (domainFilter && !isHubDomain(domainFilter)) {
        items = items.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
    }

    return { items, lastDoc: snap.docs[snap.docs.length-1] || null };
}

export const getMyVisions = async (uid: string) => (await getDocs(query(visionsCollection, where('authorId', '==', uid)))).docs.map(d => ({ id: d.id, ...(d.data() as any) } as Vision));
export const getJoinedVisions = async (uid: string) => (await getDocs(query(visionsCollection, where('joinedUserIds', 'array-contains', uid)))).docs.map(d => ({ id: d.id, ...(d.data() as any) } as Vision));

export const createVision = async (data: any) => {
    const domain = data.domain || window.location.hostname.replace(/^www\./, '');
    return addDoc(visionsCollection, { ...data, domain, createdAt: serverTimestamp(), joinedUserIds: [] });
};
export const deleteVision = (id: string) => deleteDoc(doc(db, 'visions', id));
export const joinVision = (id: string, uid: string) => updateDoc(doc(db, 'visions', id), { joinedUserIds: arrayUnion(uid) });
export const leaveVision = (id: string, uid: string) => updateDoc(doc(db, 'visions', id), { joinedUserIds: arrayRemove(uid) });

// Communities
export const fetchCommunities = async () => {
    const snap = await getDocs(query(communitiesCollection, orderBy('createdAt', 'desc')));
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as Community));
}

export const getCommunityByDomain = async (domain: string): Promise<Community | null> => {
    const normalized = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    const q = query(communitiesCollection, where('domain', '==', normalized), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() } as Community;
};

export const getMyCommunities = async (uid: string) => 
    (await getDocs(query(communitiesCollection, where('ownerId', '==', uid)))).docs.map(d => ({ id: d.id, ...(d.data() as any) } as Community));

export const createCommunity = async (data: any) => {
    const docRef = await addDoc(communitiesCollection, {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });
    return { id: docRef.id, ...data };
};

export const updateCommunity = (id: string, data: any) => 
    updateDoc(doc(db, 'communities', id), { ...data, updatedAt: serverTimestamp() });

export const deleteCommunity = (id: string) => deleteDoc(doc(db, 'communities', id));

// All events created under a community, newest first. Single-field query (no composite
// index); we filter to event pulses and sort client-side.
export const getCommunityEvents = async (communityId: string): Promise<Pulse[]> => {
    const snap = await getDocs(query(pulsesCollection, where('communityId', '==', communityId)));
    return snap.docs
        .map(d => ({ id: d.id, ...(d.data() as any) } as Pulse))
        .filter(p => p.type === 'event')
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
};

export const createCommunityEvent = async (community: Community, data: any) => {
    const eventPayload = {
        ...data,
        type: 'event',
        domain: normalizeDomain(community.domain),
        communityId: community.id,
        communityName: community.name,
    };
    const hash = await createBlock('COMMUNITY_EVENT', eventPayload, Date.now());
    const eventRef = await addDoc(pulsesCollection, {
        ...eventPayload,
        loveCount: 0,
        commentCount: 0,
        previousHash: 'COMMUNITY_EVENT',
        hash,
        createdAt: serverTimestamp(),
    });
    return { id: eventRef.id, ...eventPayload, loveCount: 0, commentCount: 0, previousHash: 'COMMUNITY_EVENT', hash } as Pulse;
};

const fetchPulsesRaw = async (lastD?: QueryDocumentSnapshot, domainFilter?: string) => {
    let q;
    if (domainFilter && !isHubDomain(domainFilter)) {
        q = query(pulsesCollection, where('domain', '==', domainFilter.replace(/^www\./, '')), limit(24));
    } else {
        q = query(pulsesCollection, orderBy('createdAt', 'desc'), limit(12));
    }

    if (lastD) q = query(q, startAfter(lastD));
    const snap = await getDocs(q);
    let items = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as Pulse));

    if (domainFilter && !isHubDomain(domainFilter)) {
        items = items.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
    }

    return { items, lastDoc: snap.docs[snap.docs.length-1] || null };
}

// The main Pulses feed shows offerings, dreams and other content pulses.
// Reaches live in the Inspiration view, so they are excluded here.
export const fetchPulses = async (lastD?: QueryDocumentSnapshot, domainFilter?: string) => {
    const res = await fetchPulsesRaw(lastD, domainFilter);
    return {
        items: res.items.filter(pulse => pulse.type !== 'reach' && (pulse as any).type !== 'tree_chat'),
        lastDoc: res.lastDoc
    };
}

export const fetchEventPulses = async (lastD?: QueryDocumentSnapshot, domainFilter?: string) => {
    const res = await fetchPulsesRaw(lastD, domainFilter);
    return {
        items: res.items.filter(pulse => pulse.type === 'event'),
        lastDoc: res.lastDoc
    };
};

// Reaches (and legacy 'tree_chat' pulses) power the Inspiration threads.
const isReachPulse = (p: Pulse) => p.type === 'reach' || (p as any).type === 'tree_chat';

export const fetchReachPulses = async (lastD?: QueryDocumentSnapshot, domainFilter?: string) => {
    const res = await fetchPulsesRaw(lastD, domainFilter);
    return {
        items: res.items.filter(isReachPulse),
        lastDoc: res.lastDoc
    };
};


// Load every reach touching a partner tree (sent to it, sent by it, or legacy chats with it),
// oldest first. Single-field queries only (no composite index); the caller orients by author.
export const fetchReachThread = async (partnerId: string) => {
    const [toPartner, fromPartner, legacy] = await Promise.all([
        getDocs(query(pulsesCollection, where('reachTreeId', '==', partnerId))),
        getDocs(query(pulsesCollection, where('lifetreeId', '==', partnerId))),
        getDocs(query(pulsesCollection, where('chatTreeId', '==', partnerId))),
    ]);
    const byId = new Map<string, Pulse>();
    [...toPartner.docs, ...fromPartner.docs, ...legacy.docs].forEach(d => {
        const p = { id: d.id, ...(d.data() as any) } as Pulse;
        if (isReachPulse(p)) byId.set(p.id, p);
    });
    return Array.from(byId.values()).sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt));
};

// All reaches involving me, both directions, newest first — my personal Inspiration inbox.
export const fetchMyReaches = async (uid: string) => {
    const [authored, received] = await Promise.all([
        getDocs(query(pulsesCollection, where('authorId', '==', uid))),
        getDocs(query(pulsesCollection, where('recipientUid', '==', uid))),
    ]);
    const byId = new Map<string, Pulse>();
    [...authored.docs, ...received.docs].forEach(d => {
        const p = { id: d.id, ...(d.data() as any) } as Pulse;
        if (isReachPulse(p)) byId.set(p.id, p);
    });
    const items = Array.from(byId.values()).sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
    return { items, lastDoc: null };
};

// Live stream of reaches addressed to me, for the unread (green glow) indicator.
// Single-field query (no composite index); we filter to reach pulses client-side.
export const listenToMyReaches = (uid: string, callback: (pulses: Pulse[]) => void) =>
    onSnapshot(query(pulsesCollection, where('recipientUid', '==', uid)), (snap) => {
        callback(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as Pulse)).filter(isReachPulse));
    });

// Live stream of reaches addressed to any of my trees. Belt-and-braces alongside
// listenToMyReaches: catches incoming reaches even when a legacy/edge send did not
// capture recipientUid, so the recipient still gets notified. Firestore 'in' caps at 10.
export const listenToReachesForTrees = (treeIds: string[], callback: (pulses: Pulse[]) => void) => {
    const ids = treeIds.filter(Boolean).slice(0, 10);
    if (ids.length === 0) { callback([]); return () => {}; }
    return onSnapshot(query(pulsesCollection, where('reachTreeId', 'in', ids)), (snap) => {
        callback(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as Pulse)).filter(isReachPulse));
    });
};

export const markReachesSeen = async (pulseIds: string[], uid: string) => {
    await Promise.all(pulseIds.map(id =>
        updateDoc(doc(db, 'pulses', id), { seenBy: arrayUnion(uid) }).catch(() => {})
    ));
};

// Public alias — batch-mark reach pulses as seen by a user (seenBy arrayUnion).
export const markReachPulsesSeen = markReachesSeen;

// Send a direct message (reach) from one tree to another.
//
// The privacy gate is enforced here as well as in the UI: a "protected" target
// (owner has onlyValidatedCanReach) only accepts reaches from the owner themselves,
// an admin/super admin, or a sender whose active tree is explicitly validated.
//
// TODO(security): Firestore security rules cannot cheaply cross-read the target's
// privacy flag at write time, so this rule is enforced in the service + UI layers.
// The target's onlyValidatedCanReach is mirrored onto its (world-readable) tree doc,
// which we read here to evaluate the gate without weakening the rules.
export const sendReach = async ({
    fromTree,
    toTree,
    text,
    sender,
    isAdmin = false,
    isSuperAdmin = false,
}: {
    fromTree: Lifetree;
    toTree: Lifetree;
    text: string;
    sender: { uid: string; displayName?: string | null; photoURL?: string | null };
    isAdmin?: boolean;
    isSuperAdmin?: boolean;
}) => {
    // Resolve the freshest target so we have its owner + privacy flag, even when the
    // caller only had a lightweight tree object (e.g. a map marker or thread summary).
    let target = toTree;
    if (!target.ownerId) {
        const full = await getLifetreeById(toTree.id);
        if (full) target = full;
    }
    const recipientUid = target.ownerId || null;

    const protectedTarget = target.onlyValidatedCanReach === true;
    const isSelf = !!recipientUid && recipientUid === sender.uid;
    if (protectedTarget && !isSelf && !isAdmin && !isSuperAdmin && !isExplicitlyValidatedTree(fromTree)) {
        throw new Error('This Lifetree only accepts direct messages from validated trees.');
    }

    return mintPulse({
        lifetreeId: fromTree.id,
        type: 'reach',
        title: `Reach: ${fromTree.name} -> ${target.name}`,
        body: text,
        content: text,
        reachTreeId: target.id,
        reachTreeName: target.name,
        recipientUid,
        recipientName: target.name,
        threadId: buildThreadId(fromTree.id, target.id),
        seenBy: [],
        authorId: sender.uid,
        authorName: fromTree.name,
        authorPhoto: fromTree.imageUrl || sender.photoURL || undefined,
    });
};

export const getLifetreeById = async (id: string): Promise<Lifetree | null> => {
    const snap = await getDoc(doc(db, 'lifetrees', id));
    return snap.exists() ? ({ id: snap.id, ...(snap.data() as any) } as Lifetree) : null;
};

export const getMyPulses = async (uid: string) => (await getDocs(query(pulsesCollection, where('authorId', '==', uid)))).docs.map(d => ({ id: d.id, ...(d.data() as any) } as Pulse)).sort((a,b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
export const fetchGrowthPulses = async (treeId: string) => (await getDocs(query(pulsesCollection, where('lifetreeId', '==', treeId), where('type', '==', 'GROWTH')))).docs.map(d => ({ id: d.id, ...(d.data() as any) } as Pulse)).sort((a,b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));

export const getPulsesByTreeId = async (treeId: string) => {
    // We fetch by ID and sort client-side to be robust against missing composite indexes
    const q = query(pulsesCollection, where('lifetreeId', '==', treeId));
    const snap = await getDocs(q);
    const pulses = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as Pulse));
    // Sort Descending (Newest -> Oldest/Genesis) so the timeline can be rendered top-down
    return pulses.sort((a,b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
}

export const mintPulse = async (pulseData: any) => {
    return runTransaction(db, async (t) => {
        const treeRef = doc(db, 'lifetrees', pulseData.lifetreeId);
        const treeDoc = await t.get(treeRef);
        if (!treeDoc.exists()) throw new Error("Tree missing");
        const tree = treeDoc.data() as Lifetree;
        const newHash = await createBlock(tree.latestHash, pulseData, Date.now());
        const newPulseRef = doc(pulsesCollection);
        const domain = tree.domain || window.location.hostname.replace(/^www\./, '');
        t.set(newPulseRef, {
            ...pulseData,
            domain,
            id: newPulseRef.id,
            loveCount: pulseData.loveCount || 0,
            commentCount: pulseData.commentCount || 0,
            createdAt: serverTimestamp(),
            hash: newHash,
            previousHash: tree.latestHash
        });
        
        const updateData: any = { latestHash: newHash, blockHeight: (tree.blockHeight || 0) + 1 };
        // If this is a growth pulse with an image, update the tree's latest growth view
        if (pulseData.type === 'GROWTH' && pulseData.imageUrl) {
            updateData.latestGrowthUrl = pulseData.imageUrl;
        }
        
        t.update(treeRef, updateData);
    });
}

export const proposeAlignment = (data: any) => addDoc(alignmentsCollection, { ...data, status: 'PENDING', createdAt: serverTimestamp() });
export const getPendingAlignments = async (uid: string) => (await getDocs(query(alignmentsCollection, where('targetUid', '==', uid), where('status', '==', 'PENDING')))).docs.map(d => ({ id: d.id, ...(d.data() as any) } as Alignment));

export const getMyAlignmentsHistory = async (uid: string) => {
    const [s1, s2] = await Promise.all([getDocs(query(alignmentsCollection, where('targetUid', '==', uid), where('status', '==', 'ACCEPTED'))), getDocs(query(alignmentsCollection, where('initiatorUid', '==', uid), where('status', '==', 'ACCEPTED')))]);
    return [...s1.docs, ...s2.docs].map(d => ({ id: d.id, ...(d.data() as any) } as Alignment)).sort((a,b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
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
            lifetreeId: proposal.initiatorTreeId, type: 'STANDARD', title: 'Alignment', body: 'Pulse Sync', 
            isMatch: true, authorId: proposal.initiatorUid, authorName: 'System', 
            createdAt: serverTimestamp(), hash: initHash 
        });
        t.update(initTreeRef, { latestHash: initHash, blockHeight: initTree.blockHeight + 1 });

        const targetTreeRef = doc(db, 'lifetrees', proposal.targetTreeId);
        const targetTree = (await t.get(targetTreeRef)).data() as Lifetree;
        const targetHash = await createBlock(targetTree.latestHash, { match: proposal.id }, Date.now());
        t.set(doc(pulsesCollection), { 
            lifetreeId: proposal.targetTreeId, type: 'STANDARD', title: 'Alignment', body: 'Pulse Sync', 
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
            const treeId = pulseData.lifetreeId || pulseData.treeId;
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
