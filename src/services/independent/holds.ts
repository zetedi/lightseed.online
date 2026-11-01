// THE INDEPENDENT NODE'S HAND for holds — the mirror of ../firebase/holds.ts (rings 2026-11-01/02).
// The view-hold is a soft, self-expiring courtesy; each hand writes only its own, near-future
// hold (the law bounds it), through the document door into the node-local ledger seed.bed_holds.
import type * as F from '../firebase/holds';
import { docAll, docCommand } from './docs';
import { HOLD_TTL_MS } from '../../domain/hold';

export const placeHold: typeof F.placeHold = async (bedId, uid) => {
    await docCommand({ action: 'set', collection: 'bed_holds', parent: bedId, id: uid, data: { holderUid: uid, expiresAt: Date.now() + HOLD_TTL_MS } });
};
export const releaseHold: typeof F.releaseHold = async (bedId, uid) => {
    await docCommand({ action: 'delete', collection: 'bed_holds', parent: bedId, id: uid }).catch(() => { /* a lapsed hold that's already gone is fine */ });
};
export const getBedHolds: typeof F.getBedHolds = async (bedId) =>
    (await docAll<{ holderUid?: string; expiresAt?: number }>('bed_holds', { parent: bedId })).map(x => ({ bedId, holderUid: x.holderUid || x.id, expiresAt: x.expiresAt || 0 }));
