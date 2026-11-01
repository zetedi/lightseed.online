import type { Store } from '../../domain/store';
import { createIndependentGraphReads } from '../../adapters/independent';
import { createGraphService } from '../graph';
import { session } from './core';

// The independent backend's graph composition (ring 2026-11-01): the paginating HTTP adapter
// for every read, and the node's link command for the two writes the Store contract names.
// The API judges each write under RLS and the ported link policies; what it refuses, it refuses.
const reads = createIndependentGraphReads(session);
const store: Store = {
  ...reads,
  async link(from, rel, to) { await session.linkCommand({ action: 'link', from, rel, to }); },
  async unlink(from, rel, to) { await session.linkCommand({ action: 'unlink', from, rel, to }); },
};
const graph = createGraphService(store);
export const graphStore = graph.store;
export const linksToTree = graph.linksToTree;
