// THE INDEPENDENT NODE'S HAND for beings — the mirror of ../firebase/beings.ts (rings 2026-11-01/02).
// The /b/<lid> door: GET /v1/beings?lid= (migration 049) names the kind and local address a true
// name has here, under the reader's own visibility; the being is then read by its door. A Light
// House's true name is looked up through the document door (its law reads the community's choice).
import type * as F from '../firebase/beings';
import { unported } from './unported';
import { readDoc } from './core';
import { docList, docCommand, serverTime } from './docs';
import type { Community, Lifetree, LightHouse, Pulse, Vision } from '../../types';
export type { FoundBeing, LidIndexReport } from '../firebase/beings';

type Found = { kind: string; id: string };
export const findBeingByLid: typeof F.findBeingByLid = async (lid) => {
    const being = await readDoc<Found>('/v1/beings?lid=' + encodeURIComponent(lid), 'being');
    if (being) {
        const id = encodeURIComponent(being.id);
        switch (being.kind) {
            case 'tree': { const tree = await readDoc<Lifetree>('/v1/trees?id=' + id, 'tree'); return tree ? { kind: 'tree', tree } : null; }
            case 'vision': { const vision = await readDoc<Vision>('/v1/visions?id=' + id, 'vision'); return vision ? { kind: 'vision', vision } : null; }
            case 'pulse': { const pulse = await readDoc<Pulse>('/v1/pulses?id=' + id, 'pulse'); return pulse ? { kind: 'pulse', pulse } : null; }
            case 'community': { const community = await readDoc<Community>('/v1/communities?id=' + id, 'community'); return community ? { kind: 'community', community } : null; }
            default: return null; // a person, or a kind this door does not open
        }
    }
    // Light Houses are not in the being lookup; their true name is asked of the houses the reader may see.
    const houses = await docList<LightHouse>('light_houses', { limit: 100 }).catch(() => ({ items: [] as (LightHouse & { id: string })[] }));
    const house = houses.items.find(h => h.lid === lid);
    return house ? { kind: 'lightHouse', lightHouse: house } : null;
};
// The lid index is a Firestore finding aid; this node resolves true names from the records themselves.
export const backfillLidIndex: typeof F.backfillLidIndex = unported('beings.backfillLidIndex');
export const mintBeingQr: typeof F.mintBeingQr = async (collectionName, id, href) => {
    const collection = collectionName === 'lightHouses' ? 'light_houses' : collectionName;
    await docCommand({ action: 'update', collection, id, patch: { qr: { href }, updatedAt: serverTime() } });
};
