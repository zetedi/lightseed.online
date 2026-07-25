import { doc, getDoc } from 'firebase/firestore';
import { dataAuthorityOf, type DataAuthority } from '../../domain/dataAuthority';
import { db } from './core';

// Public read, server-owned write (firestore.rules). A malformed or absent declaration
// resolves to null so the UI makes no sovereignty claim.
export const getDataAuthority = async (): Promise<DataAuthority | null> => {
  const snapshot = await getDoc(doc(db, 'config', 'dataAuthority'));
  return snapshot.exists() ? dataAuthorityOf(snapshot.data()) : null;
};
