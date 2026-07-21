// THE NETWORK'S HONEST FACE — one tiny store the whole app shares (2026-07-21):
//   - are we ONLINE (the browser's own online/offline events),
//   - is something IN FLIGHT long enough to feel slow (a patched fetch counts one-shot
//     requests: callables, storage, AI calls, auth sign-ins),
//   - is an UPLOAD running, and how far (storage tasks report 0..100 here).
// NetworkStatus (components/ui) renders this: the infinity loader when the network is slow,
// "Uploading: N%" beneath it, and the red no-connection snackbar.
//
// Firestore is deliberately NOT counted: its listen channels live for hours (counting them
// would pin the loader on forever) and its local cache answers reads instantly, so it never
// needs a slowness signal. Token refresh and installation pings are excluded for the same
// reason: routine background hum, not the user waiting on anything.

export interface NetSnapshot {
    online: boolean;
    inFlight: number;          // tracked one-shot requests currently on the wire
    uploadPct: number | null;  // 0..100 while a storage upload runs, else null
}

let snapshot: NetSnapshot = {
    online: typeof navigator === 'undefined' ? true : navigator.onLine,
    inFlight: 0,
    uploadPct: null,
};
const listeners = new Set<() => void>();
const set = (patch: Partial<NetSnapshot>) => {
    snapshot = { ...snapshot, ...patch };
    listeners.forEach(l => l());
};

// useSyncExternalStore pair: the snapshot object is replaced only on change, so the getter
// is stable between emissions.
export const getNetSnapshot = (): NetSnapshot => snapshot;
export const subscribeNet = (l: () => void): (() => void) => {
    listeners.add(l);
    return () => { listeners.delete(l); };
};

export const beginNetwork = () => set({ inFlight: snapshot.inFlight + 1 });
export const endNetwork = () => set({ inFlight: Math.max(0, snapshot.inFlight - 1) });
export const setUploadProgress = (pct: number | null) => set({ uploadPct: pct });

// What the patched fetch must NOT count: long-lived Firestore/WebChannel streams and the
// background auth/installation hum (see the header note).
const UNTRACKED = /firestore\.googleapis\.com|securetoken\.googleapis\.com|firebaseinstallations\.googleapis\.com/;

let watching = false;

// Called once from the app root. Patches window.fetch to count tracked requests (the promise
// resolves when headers arrive, which is exactly "the server answered") and wires the
// browser's online/offline events into the snapshot.
export const initNetworkWatch = () => {
    if (watching || typeof window === 'undefined') return;
    watching = true;
    window.addEventListener('online', () => set({ online: true }));
    window.addEventListener('offline', () => set({ online: false }));
    const original = window.fetch.bind(window);
    window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request)?.url || '';
        const tracked = !UNTRACKED.test(url);
        if (tracked) beginNetwork();
        try {
            return await original(input as RequestInfo, init);
        } finally {
            if (tracked) endNetwork();
        }
    }) as typeof window.fetch;
};
