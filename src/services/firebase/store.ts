import { firestoreStore } from '../../adapters/firestore';
import { createGraphService } from '../graph';

// The Firebase backend's graph composition: the Firestore adapter behind the shared graph
// service. services/store.ts re-exports whichever backend the build chose (ring 2026-11-01).
const graph = createGraphService(firestoreStore);
export const graphStore = graph.store;
export const linksToTree = graph.linksToTree;
