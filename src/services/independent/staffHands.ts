// THE INDEPENDENT NODE'S HAND for staff hands — the mirror of ../firebase/staffHands.ts (rings
// 2026-11-01/02). The switches live in config/staffHands, read by the staff hand alone (the law
// of the config rule) and flipped by the superadmin; an absent record means every hand is lent.
// No live channel yet: the listener asks once and then every minute.
import type * as F from '../firebase/staffHands';
import { docGet, docCommand, serverTime } from './docs';
import type { StaffHandSwitches } from '../../domain/staffHands';

export const listenStaffHands: typeof F.listenStaffHands = (cb) => {
    let alive = true;
    const tell = async () => {
        const switches = await docGet<StaffHandSwitches>('config', 'staffHands').catch(() => null);
        if (alive) cb((switches ?? {}) as StaffHandSwitches);
    };
    void tell();
    const timer = window.setInterval(() => { void tell(); }, 60_000);
    return () => { alive = false; window.clearInterval(timer); };
};
export const setStaffHand: typeof F.setStaffHand = async (id, on) => {
    await docCommand({ action: 'set', collection: 'config', id: 'staffHands', merge: true, data: { [id]: on, updatedAt: serverTime() } });
};
