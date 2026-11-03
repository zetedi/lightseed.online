// Firebase core: the single app/SDK initialization, the collection references, and the repository
// helpers shared across every aggregate module. Everything under services/firebase/ imports from
// here; services/firebase.ts re-exports the aggregates as one barrel so call sites stay unchanged.
import '../../utils/polyfill';
import { charter, firebaseCharter, nodeAuthHosts } from '../../config/charter';
import { initializeApp } from 'firebase/app';
import type { DocumentData } from 'firebase/firestore';
import { getAuth, connectAuthEmulator, onAuthStateChanged, GoogleAuthProvider, type User as FirebaseUser } from 'firebase/auth';
import { initializeFirestore, connectFirestoreEmulator, collection, doc, Timestamp } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { type Pulse, type Lightseed } from '../../types';
import { normalizePulseType } from '../../domain/pulse';
import type { Stamp } from '../../domain/time';

// Robustly read a millisecond timestamp from a Firestore Timestamp, a JS Date, or nothing.
export const toMillis = (value: unknown): number => {
    if (value instanceof Date) return value.getTime();
    const stamp = value as { toMillis?: () => number } | null | undefined;
    return typeof stamp?.toMillis === 'function' ? stamp.toMillis() : 0;
};

// STORED MOMENTS the shell makes itself (ring 2026-11-01): this backend's own Stamp, so no
// component names Firestore's Timestamp. Here the real Timestamp — Firestore keeps it as a
// moment, not a map; the independent backend answers the same two names with a plain Stamp.
export const stampOfMs = (ms: number): Stamp => Timestamp.fromMillis(ms);
export const stampNow = (): Stamp => Timestamp.now();

// One doc → one being: the id beside the fields. Firestore's DocumentData is untyped at
// the boundary; the caller names the shape it expects (mapDoc<Lifetree>(snap)).
export const mapDoc = <T>(d: { id: string; data(): DocumentData | undefined }): T => ({ id: d.id, ...d.data() } as T);

// Repository boundary: map a Firestore pulse doc → Pulse, normalising the legacy UPPERCASE
// type casing to canonical lowercase so the rest of the app only ever sees one form.
export const mapPulse = (d: { id: string; data(): DocumentData | undefined }): Pulse => {
    const data = (d.data() || {}) as Partial<Pulse> & { type?: string };
    return { id: d.id, ...data, type: normalizePulseType(data.type) } as Pulse;
};

export const SYSTEM_EMAIL_FROM = charter.mail.from;

export const getEnv = (key: string) => {
    const w = window as unknown as { process?: { env?: Record<string, string> } };
    const meta = import.meta as unknown as { env?: Record<string, string> };
    return w.process?.env?.[key] || meta.env?.[key] || "";
};

// OAuth popups display — and load their helper pages (/__/auth/*) from — authDomain. Using the
// domain the user is ALREADY on makes the Google screen say "lightseed.online" instead of the
// firebaseapp.com project name, and keeps the helpers same-origin (which also sidesteps
// third-party-storage popup issues). Only domains served by THIS Firebase Hosting site can do
// that (Hosting auto-serves /__/auth/* there), and each one must first be wired up in the
// consoles: Firebase Auth → Authorized domains, AND the Google OAuth client's JS origins +
// redirect URI (https://<domain>/__/auth/handler). The charter DECLARES which face hosts are
// wired (node.json authHosts; ring 2026-09-16) — the node's own domains always are. Everywhere
// else (localhost, previews, an unwired face) we fall back to the env authDomain.
const HOSTED_AUTH_DOMAINS = nodeAuthHosts;
const currentHost = window.location.hostname.replace(/^www\./, '');

// The charter is the node (config/charter → node.json); an env var still overrides it, so a
// local run may point at an emulator or a preview project without touching the charter.
const { firebase: project } = firebaseCharter();
const web = project.web;
const firebaseConfig = {
  apiKey: getEnv('VITE_FIREBASE_API_KEY') || web.apiKey,
  authDomain: HOSTED_AUTH_DOMAINS.includes(currentHost) ? currentHost : (getEnv('VITE_FIREBASE_AUTH_DOMAIN') || web.authDomain),
  projectId: getEnv('VITE_FIREBASE_PROJECT_ID') || project.projectId,
  storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET') || project.bucket,
  messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID') || web.messagingSenderId,
  appId: getEnv('VITE_FIREBASE_APP_ID') || web.appId,
  measurementId: getEnv('VITE_FIREBASE_MEASUREMENT_ID') || web.measurementId,
};

console.log("Firebase Init - Project:", firebaseConfig.projectId, "Has Key:", !!firebaseConfig.apiKey);

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, { ignoreUndefinedProperties: true });
export const storage = getStorage(app);
export const functions = getFunctions(app);
export const googleProvider = new GoogleAuthProvider();

// THE OFFLINE FOREST (npm run devui): with VITE_USE_EMULATORS set, every SDK binds to the local
// Firebase Emulator Suite, so the whole app runs without internet and without spending a byte of
// production data. Double-guarded to localhost so a production build can never carry it. Sign-in
// uses the Auth emulator's fake account picker; images land in the local Storage emulator; the
// data lives in ./.emulator-data between runs. Callables reach the local Functions emulator only
// if it was started; otherwise they fail fast and locally, never toward production.
if (getEnv('VITE_USE_EMULATORS') && ['localhost', '127.0.0.1'].includes(window.location.hostname)) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099');
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
    connectStorageEmulator(storage, '127.0.0.1', 9199);
    connectFunctionsEmulator(functions, '127.0.0.1', 5001);
    console.log('Firebase emulators connected: the forest is running on this machine.');
}

export const mailCollection = collection(db, 'mail');
export const subsCollection = collection(db, 'subscriptions');
export const usersCollection = collection(db, 'users');
export const lifetreesCollection = collection(db, 'lifetrees');
export const visionsCollection = collection(db, 'visions');
export const pulsesCollection = collection(db, 'pulses');
export const alignmentsCollection = collection(db, 'alignments');
export const covenantsCollection = collection(db, 'covenants');
export const communitiesCollection = collection(db, 'communities');
export const lightHousesCollection = collection(db, 'lightHouses');
export const networkInvitesCollection = collection(db, 'networkInvites');
export const communityInvitesCollection = collection(db, 'communityInvites');
export const newsletterConfigRef = doc(db, 'config', 'newsletter');

// The signed-in hand as the shell knows it (types.ts Lightseed): four fields of the provider's
// user, nothing else of it — the same four the independent session supplies (ring 2026-11-01).
const lightseedOf = (user: FirebaseUser): Lightseed =>
    ({ uid: user.uid, email: user.email, displayName: user.displayName, photoURL: user.photoURL });
export const onAuthChange = (callback: (user: Lightseed | null) => void): (() => void) =>
    onAuthStateChanged(auth, user => callback(user ? lightseedOf(user) : null));

// HOW THIS NODE SIGNS A HAND IN (ring 2026-11-01): the shell's sign-in door asks before it
// draws. Here: email + password and Google; no separate issuer door.
export const authCapabilities = (): { emailPassword: boolean; google: boolean; issuer: boolean } =>
    ({ emailPassword: true, google: true, issuer: false });
export const signInWithIssuer = async (): Promise<void> => { throw new Error('auth_issuer_unavailable'); };

// When this account began — the provider's record of the login's creation, else unknown.
export const accountCreatedAtMs = (): number | null => {
    const created = auth.currentUser?.metadata?.creationTime;
    const ms = created ? Date.parse(created) : NaN;
    return Number.isFinite(ms) ? ms : null;
};
