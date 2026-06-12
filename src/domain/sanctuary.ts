import type { Timestamp } from 'firebase/firestore';

// A sanctuary is a sacred place / platform that holds a community's lifetrees —
// e.g. "The Secret Sun" for lightseed. Like the first tree, it is data-driven per
// domain: each node shows its own first sanctuary, generically "The Sanctuary".
export interface Sanctuary {
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
