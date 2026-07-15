// Firebase core: the single app/SDK initialization, the collection references, and the repository
// helpers shared across every aggregate module. Everything under services/firebase/ imports from
// here; services/firebase.ts re-exports the aggregates as one barrel so call sites stay unchanged.
import '../../utils/polyfill';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, GoogleAuthProvider, type User as FirebaseUser } from 'firebase/auth';
import { initializeFirestore, collection, doc } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';
import { type Pulse } from '../../types';
import { normalizePulseType } from '../../domain/pulse';

// Robustly read a millisecond timestamp from a Firestore Timestamp, a JS Date, or nothing.
export const toMillis = (value: any): number =>
    value?.toMillis ? value.toMillis() : (value instanceof Date ? value.getTime() : 0);

// Repository boundary: map a Firestore doc snapshot → a domain object ({ id, ...fields }). The one
// place the `id`-merge + `as any` cast lives, so call sites read cleanly and stay type-consistent.
export const mapDoc = <T = any>(d: any): T => ({ id: d.id, ...d.data() } as any as T);

// Repository boundary: map a Firestore pulse doc → Pulse, normalising the legacy UPPERCASE
// type casing to canonical lowercase so the rest of the app only ever sees one form.
export const mapPulse = (d: any): Pulse => {
    const data = d.data() as any;
    return { id: d.id, ...data, type: normalizePulseType(data.type) } as Pulse;
};

export const SYSTEM_EMAIL_FROM = "lightseed <admin@lightseed.online>";

export const getEnv = (key: string) => {
    return (window as any).process?.env?.[key] || (import.meta as any).env?.[key] || "";
};

// OAuth popups display — and load their helper pages (/__/auth/*) from — authDomain. Using the
// domain the user is ALREADY on makes the Google screen say "lightseed.online" instead of the
// firebaseapp.com project name, and keeps the helpers same-origin (which also sidesteps
// third-party-storage popup issues). Only domains served by THIS Firebase Hosting site can do
// that (Hosting auto-serves /__/auth/* there), and each one must first be wired up in the
// consoles: Firebase Auth → Authorized domains, AND the Google OAuth client's JS origins +
// redirect URI (https://<domain>/__/auth/handler). Everywhere else (localhost, previews) we
// fall back to the env authDomain.
const HOSTED_AUTH_DOMAINS = ['lightseed.online', 'lifeseed.online'];
const currentHost = window.location.hostname.replace(/^www\./, '');

const firebaseConfig = {
  apiKey: getEnv('VITE_FIREBASE_API_KEY'),
  authDomain: HOSTED_AUTH_DOMAINS.includes(currentHost) ? currentHost : getEnv('VITE_FIREBASE_AUTH_DOMAIN'),
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
export const googleProvider = new GoogleAuthProvider();

export const mailCollection = collection(db, 'mail');
export const subsCollection = collection(db, 'subscriptions');
export const usersCollection = collection(db, 'users');
export const lifetreesCollection = collection(db, 'lifetrees');
export const visionsCollection = collection(db, 'visions');
export const pulsesCollection = collection(db, 'pulses');
export const alignmentsCollection = collection(db, 'alignments');
export const communitiesCollection = collection(db, 'communities');
export const sanctuariesCollection = collection(db, 'sanctuaries');
export const networkInvitesCollection = collection(db, 'networkInvites');
export const communityInvitesCollection = collection(db, 'communityInvites');
export const newsletterConfigRef = doc(db, 'config', 'newsletter');

export const onAuthChange = (callback: (user: FirebaseUser | null) => void) => onAuthStateChanged(auth, callback);
