import type { Store } from '../../domain/store';
import { createIndependentGraphReads } from '../../adapters/independent';
import { createGraphService } from '../graph';
import { session, readDoc, currentUid } from './core';
import { linkRouteOf, needsTargetKind } from '../../domain/seedLinkRoute';

// The independent backend's graph composition (ring 2026-11-01): the paginating HTTP adapter
// for every read, and the node's link command for the two writes the Store contract names.
// The API judges each write under RLS and the ported link policies; what it refuses, it refuses.
const reads = createIndependentGraphReads(session);
// THE DOORS (ring 2026-11-17): a consent-bearing relation goes to its own command — the
// community's door, the tree's keeping knock — and only the rest to the link command
// (domain/seedLinkRoute). The target is read only for the two relations a community and a tree share.
const isCommunity = async (id: string): Promise<boolean> =>
  !!(await readDoc<{ id: string }>('/v1/communities?id=' + encodeURIComponent(id), 'community').catch(() => null));
const write = async (action: 'link' | 'unlink', from: string, rel: string, to: string): Promise<void> => {
  const route = linkRouteOf({ action, from, rel, to, me: currentUid(), ...(needsTargetKind(rel) ? { toIsCommunity: await isCommunity(to) } : {}) });
  if (route.door === 'community') await session.communityCommand(route.command);
  else if (route.door === 'tree') await session.treeCommand(route.command);
  else await session.linkCommand(route.command);
};
const store: Store = {
  ...reads,
  link: (from, rel, to) => write('link', from, rel, to),
  unlink: (from, rel, to) => write('unlink', from, rel, to),
};
const graph = createGraphService(store);
export const graphStore = graph.store;
export const linksToTree = graph.linksToTree;
