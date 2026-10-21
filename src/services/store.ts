import { firestoreStore } from '../adapters/firestore';
import { createGraphService } from './graph';

// The current application's graph composition boundary. Only this module selects a
// concrete graph adapter; UI and service callers depend on the Store contract.
// PostgreSQL is not selected until its API and authorization implementation exist.
// Session, documents, media and callables need their own ports before a node can
// operate independently; selecting a different graph adapter alone is insufficient.
const graph = createGraphService(firestoreStore);
export const graphStore = graph.store;
export const linksToTree = graph.linksToTree;
