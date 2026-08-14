import { initializeApp, deleteApp, type FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, type Auth } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, type Firestore } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator, type Functions } from 'firebase/functions';
import { initializeApp as adminInit, getApps as adminApps, type App as AdminApp } from 'firebase-admin/app';
import { getFirestore as adminFirestore, type Firestore as AdminFirestore } from 'firebase-admin/firestore';

// The world the Grove grows in — personas, emulator plumbing, and the patience helpers.
// Every persona is a REAL web-SDK app signed in through the Auth emulator, so one uid flows
// identically through the Firestore rules AND every callable's request.auth: nothing here
// bypasses the node's skin except the named admin hand (the backend the node already trusts).

export const PROJECT_A = 'demo-lifeseed';   // the living node (functions watch THIS namespace)
export const PROJECT_B = 'demo-node-b';     // the far shore — no functions, no triggers, silence

const FIRESTORE_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
const [FS_ADDR, FS_PORT] = FIRESTORE_HOST.split(':');
const FUNCTIONS_PORT = 5001;

export interface Persona {
  name: string;
  uid: string;
  lid: string;
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  fns: Functions;
}

// ── Admin hands ─────────────────────────────────────────────────────────────────────────
// Two named admin apps: A is "the backend" of the living node; B is the far shore's.
// Under emulators:exec the env vars are already injected, so no credentials are needed —
// and demo- projects cannot reach production by construction.
const admin = (project: string): AdminApp => {
  const existing = adminApps().find(a => a.name === project);
  return existing ?? adminInit({ projectId: project }, project);
};
export const adminDbA = (): AdminFirestore => adminFirestore(admin(PROJECT_A));
export const adminDbB = (): AdminFirestore => adminFirestore(admin(PROJECT_B));

// ── Personas ────────────────────────────────────────────────────────────────────────────
const madePersonas: Persona[] = [];

export const bringToLife = async (name: string, lid: string): Promise<Persona> => {
  const app = initializeApp({ projectId: PROJECT_A, apiKey: 'fake-api-key' }, `persona-${name}`);
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${AUTH_HOST}`, { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, FS_ADDR, Number(FS_PORT));
  const fns = getFunctions(app);
  connectFunctionsEmulator(fns, FS_ADDR, FUNCTIONS_PORT);
  const cred = await createUserWithEmailAndPassword(auth, `${name.toLowerCase()}@grove.demo`, 'a-living-password');
  const persona: Persona = { name, uid: cred.user.uid, lid, app, auth, db, fns };
  madePersonas.push(persona);
  return persona;
};

export const releasePersonas = async (): Promise<void> => {
  await Promise.all(madePersonas.splice(0).map(p => deleteApp(p.app).catch(() => {})));
};

// ── Patience — emulated triggers are async and at-least-once ───────────────────────────
export const waitFor = async <T>(read: () => Promise<T | null | undefined>, what: string, timeoutMs = 20_000): Promise<T> => {
  const start = Date.now();
  for (;;) {
    const value = await read().catch(() => null);
    if (value !== null && value !== undefined) return value;
    if (Date.now() - start > timeoutMs) throw new Error(`waited ${timeoutMs}ms for ${what} — it never came`);
    await new Promise(r => setTimeout(r, 150));
  }
};

// ── Clean ground — the REST wipe (admin deletes would fire triggers mid-cleanup) ────────
export const wipeProject = async (project: string): Promise<void> => {
  await fetch(`http://${FIRESTORE_HOST}/emulator/v1/projects/${project}/databases/(default)/documents`, { method: 'DELETE' });
  await fetch(`http://${AUTH_HOST}/emulator/v1/projects/${project}/accounts`, { method: 'DELETE' }).catch(() => {});
};
