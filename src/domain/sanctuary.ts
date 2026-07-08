import type { Timestamp } from 'firebase/firestore';
import type { Entity } from './entity';

// A sanctuary is a sacred place / platform that holds a community's lifetrees —
// e.g. "The Secret Sun" for lightseed. Like the first tree, it is data-driven per
// domain: each node shows its own first sanctuary, generically "The Sanctuary".
// An Entity like every other being — it carries a lid (backfilled by migrateBackfillLids).
export interface Sanctuary extends Entity {
  id: string;
  name: string;
  shortTitle?: string;
  body: string;
  imageUrl?: string;
  domain?: string;
  locationName?: string;
  latitude?: number;
  longitude?: number;
  createdAt: Timestamp;
}
