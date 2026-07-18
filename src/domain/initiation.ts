// The initiated layer — the app-side reader of the git initiation ledger.
//
// Source of truth is initiations/*.json in the repo (three-sponsor rule, enforced in CI);
// `scripts/build-initiates.mjs` mirrors it to public/initiates.json at build time, and this module
// reads that mirror. Nothing here grants initiation — it only reflects what git holds. An initiate
// record that declares a `uid` binds the ledger identity to an app account; that binding is what
// unlocks the initiate rights in the UI (validate trees, form communities). The Firestore mirror
// (initiates/{uid}, synced by the superadmin) is what the security rules check server-side.

export interface Initiate {
  handle: string;
  name: string;
  lid: string; // the UUIDv7 Lightseed ID — the portable true name (equals persons/{uid}.lid)
  pubkey: string;
  uid?: string;
  domain?: string;
  genesis?: boolean;
  initiatedAt: string;
}

let cache: Promise<Initiate[]> | null = null;

// Load the mirrored ledger once per session. A missing/broken mirror = no initiates (never throws).
export const loadInitiates = (): Promise<Initiate[]> => {
  if (!cache) {
    cache = fetch('/initiates.json')
      .then(r => (r.ok ? r.json() : { initiates: [] }))
      .then(d => (Array.isArray(d?.initiates) ? (d.initiates as Initiate[]) : []))
      .catch(() => []);
  }
  return cache;
};

export const getInitiateByUid = async (uid?: string | null): Promise<Initiate | null> => {
  if (!uid) return null;
  return (await loadInitiates()).find(i => i.uid === uid) || null;
};

export const isInitiateUid = async (uid?: string | null): Promise<boolean> =>
  !!(await getInitiateByUid(uid));
