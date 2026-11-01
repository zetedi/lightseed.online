// THE INDEPENDENT NODE'S HAND for push — the mirror of ../firebase/push.ts (rings 2026-11-01/02).
// The device half is shared (services/pushDevice); the subscription rests in the node-local
// ledger seed.push_subscriptions under the device's own account (the users/*/pushSubscriptions
// law), written through the document door. The knock itself — when a reach arrives — is the
// node's push organ, which sends with the installation's VAPID key.
import type * as F from '../firebase/push';
import { docCommand, serverTime } from './docs';
import { pushSubscriptionIdOf } from '../../domain/push';
import { VAPID_PUBLIC_KEY, pushSupported, pushRegistration, urlBase64ToUint8Array, type PushState } from '../pushDevice';
export { VAPID_PUBLIC_KEY, pushSupported, pushState, type PushState } from '../pushDevice';

export const enablePush: typeof F.enablePush = async (uid) => {
    if (!pushSupported() || !VAPID_PUBLIC_KEY) return 'unsupported';
    const reg = await pushRegistration();
    if (!reg) return 'unsupported';
    if ((await Notification.requestPermission()) !== 'granted') return 'denied';
    const sub = await reg.pushManager.getSubscription() ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) });
    const json = sub.toJSON();
    await docCommand({ action: 'set', collection: 'push_subscriptions', parent: uid, id: pushSubscriptionIdOf(sub.endpoint), data: {
        endpoint: sub.endpoint, keys: { p256dh: json.keys?.p256dh || '', auth: json.keys?.auth || '' }, userAgent: navigator.userAgent.slice(0, 200), createdAt: serverTime(),
    } });
    return 'on' as PushState;
};
export const disablePush: typeof F.disablePush = async (uid) => {
    const reg = await pushRegistration();
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    if (sub) {
        await docCommand({ action: 'delete', collection: 'push_subscriptions', parent: uid, id: pushSubscriptionIdOf(sub.endpoint) }).catch(() => {});
        await sub.unsubscribe();
    }
    return 'off' as PushState;
};
