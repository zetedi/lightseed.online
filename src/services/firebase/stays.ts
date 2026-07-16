import { addDoc, collection, getDocs, query, serverTimestamp, where, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, mapDoc } from './core';
import { uuidv7 } from '../../utils/id';
import { nightsBetween, type Stay, type StayStatus } from '../../domain/stay';
import type { LightHouse } from '../../types';

// Stays — bed requests under a lightHouse's roof. The stay denormalises the keeper
// (hostUid) so the rules and the keeper's inbox query stand on plain fields.

const staysCollection = collection(db, 'stays');

export const requestStay = async (
    lightHouse: LightHouse,
    guest: { uid: string; name?: string },
    draft: { fromDate: string; toDate: string; note?: string },
): Promise<string> => {
    const ref = await addDoc(staysCollection, {
        lid: uuidv7(),
        lightHouseId: lightHouse.id,
        lightHouseName: lightHouse.name,
        uid: guest.uid,
        guestName: guest.name || '',
        hostUid: lightHouse.ownerId || '',
        fromDate: draft.fromDate,
        toDate: draft.toDate,
        nights: nightsBetween(draft.fromDate, draft.toDate),
        note: draft.note || '',
        status: 'requested',
        createdAt: serverTimestamp(),
    });
    return ref.id;
};

// The keeper's view of a lightHouse's stays (their hostUid makes the query provable).
export const getStaysForHost = async (hostUid: string, lightHouseId?: string): Promise<Stay[]> => {
    const q = lightHouseId
        ? query(staysCollection, where('hostUid', '==', hostUid), where('lightHouseId', '==', lightHouseId))
        : query(staysCollection, where('hostUid', '==', hostUid));
    return (await getDocs(q)).docs.map(d => (mapDoc(d) as Stay));
};

// The guest's own requests.
export const getMyStays = async (uid: string, lightHouseId?: string): Promise<Stay[]> => {
    const q = lightHouseId
        ? query(staysCollection, where('uid', '==', uid), where('lightHouseId', '==', lightHouseId))
        : query(staysCollection, where('uid', '==', uid));
    return (await getDocs(q)).docs.map(d => (mapDoc(d) as Stay));
};

export const setStayStatus = (stayId: string, status: StayStatus) =>
    updateDoc(doc(db, 'stays', stayId), { status, updatedAt: serverTimestamp() });

export const withdrawStay = (stayId: string) => deleteDoc(doc(db, 'stays', stayId));
