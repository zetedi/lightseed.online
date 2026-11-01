// THE INDEPENDENT NODE'S HAND for stays — the mirror of ../firebase/stays.ts (rings 2026-11-01/02).
// A stay is a request to sleep in a bed: the guest writes it through the document door (the law
// binds the host to the bed's keeper), the host answers with a status, and the node's occupancy
// mirror (migration 051) publishes the identity-free nights or refuses a double-booking.
import type * as F from '../firebase/stays';
import { docAll, docCommand, serverTime } from './docs';
import { nightsBetween, type Stay } from '../../domain/stay';
import { uuidv7 } from '../../utils/id';

export const requestStay: typeof F.requestStay = async (bed, guest, draft) => {
    const born = await docCommand({ action: 'create', collection: 'stays', data: {
        lid: uuidv7(), bedId: bed.id, bedName: bed.name || '', lightHouseId: bed.lightHouseId || '', uid: guest.uid, guestName: guest.name || '',
        guestTreeId: guest.tree?.id || '', guestTreeName: guest.tree?.name || '', guestTreeGrowthUrl: guest.tree?.growthUrl || '',
        hostUid: bed.anchorUid, fromDate: draft.fromDate, toDate: draft.toDate, nights: nightsBetween(draft.fromDate, draft.toDate),
        note: draft.note || '', status: 'requested', createdAt: serverTime(),
    } });
    return born.id;
};
export const getBedStaysForHost: typeof F.getBedStaysForHost = (bedId, hostUid) => docAll<Stay>('stays', { where: { bedId, hostUid } });
export const getMyBedStays: typeof F.getMyBedStays = (bedId, uid) => docAll<Stay>('stays', { where: { bedId, uid } });
export const readBedOccupancy: typeof F.readBedOccupancy = async (bedId) =>
    (await docAll<{ fromDate?: string; toDate?: string }>('lifetree_occupancy', { parent: bedId })).map(x => ({ fromDate: x.fromDate || '', toDate: x.toDate || '' }));
export const getStaysForHost: typeof F.getStaysForHost = (hostUid, lightHouseId) => docAll<Stay>('stays', { where: { hostUid, ...(lightHouseId ? { lightHouseId } : {}) } });
export const getMyStays: typeof F.getMyStays = (uid, lightHouseId) => docAll<Stay>('stays', { where: { uid, ...(lightHouseId ? { lightHouseId } : {}) } });
export const setStayStatus: typeof F.setStayStatus = async (stayId, status) => {
    await docCommand({ action: 'update', collection: 'stays', id: stayId, patch: { status, updatedAt: serverTime() } });
};
export const withdrawStay: typeof F.withdrawStay = async (stayId) => { await docCommand({ action: 'delete', collection: 'stays', id: stayId }); };
