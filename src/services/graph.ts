import type { Store } from '../domain/store';
import type { Link } from '../domain/link';
import { isSecretTree, mergeLinks } from '../domain/secretTree';

// Backend-independent graph orchestration. The datastore still decides what the
// asking hand may read. This module neither authenticates nor grants visibility.
export const createGraphService = <T extends Pick<Store, 'linksTo' | 'secretLinksTo'>>(store: T) => ({
  store,
  async linksToTree(tree: { id: string; treeType?: string | null }): Promise<Link[]> {
    const open = await store.linksTo(tree.id);
    if (!isSecretTree(tree)) return open;
    // Preserve the existing secret-circle behavior: a refused/unavailable private
    // ledger contributes no seats. Public-ledger errors still reach the caller.
    // This is a display aggregate, never a server-side authorization decision.
    const secret = await store.secretLinksTo(tree.id).catch(() => [] as Link[]);
    return mergeLinks(open, secret);
  },
});
