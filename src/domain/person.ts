import type { Timestamp } from 'firebase/firestore';
import type { Entity } from './entity';

// The canonical PERSON entity — one per user, the human's own node in the LIN. Stage 1 of the
// identity work: the auth `uid` stays the key, but each person now carries a portable `lid`
// (their true-name) and a reserved slot for a public key. Later stages move links to point at
// person lids (entity→entity) and sign chain blocks with the keypair, so authorship is provable
// and separate forests can merge. See memory: mergeable-identity, lid-lin-entity.
export interface Person extends Entity {
  lid: string;
  uid: string;
  displayName?: string;
  publicKeyPem?: string | null; // reserved for Stage 3 (keypair signing) — null until then
  createdAt: Timestamp;
}
