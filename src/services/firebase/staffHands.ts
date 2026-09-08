import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './core';
import type { StaffHandSwitches } from '../../domain/staffHands';

// The switches of the staff hands (domain/staffHands): one document, config/staffHands, read by
// firestore.rules (staffHand) and written by the superadmin from the admin panel.
export const listenStaffHands = (cb: (switches: StaffHandSwitches) => void) =>
    onSnapshot(doc(db, 'config', 'staffHands'), (snap) => cb((snap.exists() ? (snap.data() as StaffHandSwitches) : {})), () => cb({}));

export const setStaffHand = (id: string, on: boolean) =>
    setDoc(doc(db, 'config', 'staffHands'), { [id]: on, updatedAt: serverTimestamp() }, { merge: true });
