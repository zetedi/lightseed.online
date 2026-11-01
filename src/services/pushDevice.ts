import { charter } from '../config/charter';

// PUSH ON THE DEVICE, the browser's half (lifted from services/firebase/push on 2026-11-01 so both
// backends share it): whether this browser can receive, what it currently holds, and the public
// VAPID key it subscribes with. Recording the subscription with the node is each backend's hand.
// The public VAPID key is public by nature; the private half stays on the server.
export const VAPID_PUBLIC_KEY = charter.push.publicKey;

export type PushState = 'unsupported' | 'denied' | 'off' | 'on';

export const urlBase64ToUint8Array = (base64: string): Uint8Array => {
    const padding = '='.repeat((4 - (base64.length % 4)) % 4);
    const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

// A registration, if the PWA's worker stands (never waits on `ready` — in a window without a
// worker that promise would hang forever).
export const pushRegistration = () => navigator.serviceWorker.getRegistration();

export const pushSupported = (): boolean =>
    typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export const pushState = async (): Promise<PushState> => {
    if (!pushSupported()) return 'unsupported';
    if (Notification.permission === 'denied') return 'denied';
    const reg = await pushRegistration();
    if (!reg) return 'unsupported';
    return (await reg.pushManager.getSubscription()) ? 'on' : 'off';
};
