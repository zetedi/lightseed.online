// THE INDEPENDENT NODE'S HAND for authority — the mirror of ../firebase/authority.ts (rings
// 2026-11-01/02). config/dataAuthority is the node's public custody declaration (world-readable,
// written only by the installation's create-once ceremony, seed:configure); a malformed or absent
// declaration resolves to null so the shell makes no sovereignty claim.
import type * as F from '../firebase/authority';
import { dataAuthorityOf } from '../../domain/dataAuthority';
import { docGet } from './docs';

export const getDataAuthority: typeof F.getDataAuthority = async () => {
    const declaration = await docGet('config', 'dataAuthority').catch(() => null);
    return declaration ? dataAuthorityOf(declaration) : null;
};
