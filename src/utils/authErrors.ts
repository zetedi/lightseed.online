// Friendly copy for Firebase Auth errors. Raw SDK messages read like stack traces
// ("Firebase: Error (auth/invalid-credential)."), so the modal translates the codes a person
// can actually act on and keeps a gentle fallback for the rest.
const FRIENDLY: Record<string, string> = {
  'auth/invalid-credential': "That email and password don't match. Please try again — or tap “Forgot password?” and we'll help you back in.",
  'auth/wrong-password': "That email and password don't match. Please try again — or tap “Forgot password?” and we'll help you back in.",
  'auth/user-not-found': "We couldn't find an account with that email. Check the spelling, or create a new account.",
  'auth/invalid-email': 'That email address doesn\'t look quite right. Could you check it?',
  'auth/email-already-in-use': 'There is already an account with this email. Try signing in instead.',
  'auth/weak-password': 'Please choose a slightly longer password (at least 6 characters).',
  'auth/too-many-requests': 'Too many attempts for now. Please wait a little while and try again.',
  'auth/network-request-failed': 'We could not reach the network. Please check your connection and try again.',
  'auth/popup-closed-by-user': 'The sign-in window was closed before finishing. No worries — just try again when you\'re ready.',
  'auth/cancelled-popup-request': 'The sign-in window was closed before finishing. No worries — just try again when you\'re ready.',
  'auth/popup-blocked': 'Your browser blocked the sign-in window. Please allow pop-ups for this site and try again.',
  'auth/user-disabled': 'This account has been disabled. Please contact us if you think this is a mistake.',
  'auth/requires-recent-login': 'For safety, please sign out and sign in again before doing this.',
};

// Firebase errors carry the code both in `e.code` and inside the message ("(auth/…)").
const authCode = (e: any): string =>
  e?.code || (String(e?.message || '').match(/\(auth\/[a-z-]+\)/)?.[0]?.slice(1, -1) ?? '');

// The person simply dismissed the sign-in popup, or a double-trigger cancelled a redundant one
// while the first already completed. Not a failure to surface — the caller swallows it silently
// so no alarm appears after a normal (or intentionally abandoned) sign-in.
export const isUserCancelledAuth = (e: any): boolean => {
  const code = authCode(e);
  return code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request';
};

export const friendlyAuthError = (e: any, fallback: string): string => {
  const code = authCode(e);
  if (code && FRIENDLY[code]) return FRIENDLY[code];
  const message = String(e?.message || '');
  // A hand-thrown, already-human message (no Firebase wrapper) passes through untouched.
  if (message && !message.startsWith('Firebase:') && !message.includes('auth/')) return message;
  return fallback;
};
