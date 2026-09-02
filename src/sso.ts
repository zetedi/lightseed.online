// The SSO door's hand — the entry behind /sso.html, a page with no face. A mother site
// (theohouse.org) iframes it; because apex and subdomain are the same site, this frame
// stands unpartitioned inside the seed's own Firebase session and can say who is home.
// domain/ssoDoor.ts is the law: which parents may speak, and the five message names.
//
// Deliberately NOT importing services/firebase/core: that barrel wakes Firestore,
// Storage and the whole polyfill. The door carries only auth and functions — it must
// stay the lightest thing the seed serves.
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  connectAuthEmulator,
  onAuthStateChanged,
  signOut,
  type User,
} from 'firebase/auth';
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions';
import { SSO_DOOR, ssoParentOrigins } from './domain/ssoDoor';

const env = (key: string): string => (import.meta as any).env?.[key] || '';

const init = () => {
  const app = initializeApp({
    apiKey: env('VITE_FIREBASE_API_KEY'),
    projectId: env('VITE_FIREBASE_PROJECT_ID'),
    appId: env('VITE_FIREBASE_APP_ID'),
  });
  const auth = getAuth(app);
  const functions = getFunctions(app);

  // THE OFFLINE FOREST: the same double guard as services/firebase/core.ts — emulators
  // only when asked for AND on localhost, so a production build can never carry it.
  const onLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  if (env('VITE_USE_EMULATORS') && onLocalhost) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099');
    connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  }

  // The law, plus one dev allowance: a door served on localhost may speak to a
  // localhost parent (the mother site's own dev server on another port).
  const allowed = ssoParentOrigins(window.location.hostname);
  const isAllowedParent = (origin: string): boolean =>
    allowed.includes(origin) || (onLocalhost && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin));

  // The door speaks to ONE parent: the first allowed origin that says hello. Everything
  // later — mint, signout, volunteered state — flows only to and from that origin.
  let parentOrigin: string | null = null;

  const sendState = (user: User | null) => {
    if (!parentOrigin) return;
    window.parent.postMessage(
      {
        type: SSO_DOOR.state,
        // Only what a greeting needs — the uid to compare sessions, a name to say.
        // The parent renders it with textContent; still, never send more than asked.
        user: user ? { uid: user.uid, name: user.displayName || user.email || null } : null,
      },
      parentOrigin
    );
  };

  // The mint: ask the seed for a custom token re-speaking this session's own identity,
  // so the mother page can sign in as the same person. A failed mint answers null —
  // the parent's greeting stays honest (the SEED session is real either way).
  let minting = false;
  const mint = async () => {
    if (minting || !parentOrigin) return;
    minting = true;
    try {
      const answer = await httpsCallable<Record<string, never>, { token: string }>(
        functions,
        'mintSsoToken'
      )({});
      window.parent.postMessage({ type: SSO_DOOR.token, token: answer.data.token }, parentOrigin);
    } catch (error) {
      console.warn('sso door: the mint did not answer', error);
      window.parent.postMessage({ type: SSO_DOOR.token, token: null }, parentOrigin);
    } finally {
      minting = false;
    }
  };

  window.addEventListener('message', (event: MessageEvent) => {
    const type = (event.data as { type?: unknown } | null)?.type;
    if (type === SSO_DOOR.hello && isAllowedParent(event.origin)) {
      parentOrigin = event.origin;
      // Answer only once the session is actually known — before authStateReady the
      // door would say "nobody home" to a signed-in house.
      auth.authStateReady().then(() => sendState(auth.currentUser));
      return;
    }
    if (!parentOrigin || event.origin !== parentOrigin) return;
    if (type === SSO_DOOR.mint) void mint();
    if (type === SSO_DOOR.signout) void signOut(auth);
  });

  // Volunteer every change after the hello: sign-in in another seed tab reaches the
  // mother page live, and a signout mirrors back through the same door.
  let announced = false;
  onAuthStateChanged(auth, (user) => {
    if (!announced) {
      announced = true; // the hello path already answers the first state
      return;
    }
    sendState(user);
  });
};

// A door with no house around it stays shut: only initialize when actually iframed.
if (window.parent !== window) init();
