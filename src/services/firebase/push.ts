import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './core';
import { pushSubscriptionIdOf } from '../../domain/push';
import { VAPID_PUBLIC_KEY, pushSupported, pushRegistration, urlBase64ToUint8Array, type PushState } from '../pushDevice';

// PUSH on the device (ring 2026-09-06) — the seed is a PWA; when a being allows it, the browser
// hands the node a subscription (endpoint + keys), kept under users/{uid}/pushSubscriptions by
// its endpoint's id (domain/push), and functions/onReachCreated knocks there when a reach comes.
// The device half (support, state, the public VAPID key) is shared with the independent backend
// (services/pushDevice, ring 2026-11-01); recording the subscription is this backend's hand.
export { VAPID_PUBLIC_KEY, pushSupported, pushState, type PushState } from '../pushDevice';

export const enablePush = async (uid: string): Promise<PushState> => {
    if (!pushSupported()) return 'unsupported';
    const reg = await pushRegistration();
    if (!reg) return 'unsupported';
    if ((await Notification.requestPermission()) !== 'granted') return 'denied';
    const sub = await reg.pushManager.getSubscription()
        ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) });
    const json = sub.toJSON();
    await setDoc(doc(db, 'users', uid, 'pushSubscriptions', pushSubscriptionIdOf(sub.endpoint)), {
        endpoint: sub.endpoint,
        keys: { p256dh: json.keys?.p256dh || '', auth: json.keys?.auth || '' },
        userAgent: navigator.userAgent.slice(0, 200),
        createdAt: serverTimestamp(),
    });
    return 'on';
};

export const disablePush = async (uid: string): Promise<PushState> => {
    const reg = await pushRegistration();
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    if (sub) {
        await deleteDoc(doc(db, 'users', uid, 'pushSubscriptions', pushSubscriptionIdOf(sub.endpoint))).catch(() => {});
        await sub.unsubscribe();
    }
    return 'off';
};
