import type { Timestamp } from 'firebase/firestore';

// Who a reach is addressed to within a tree's circle. Audiences nest: 'guardians'
// includes the owners, 'everyone' includes the guardians. ('owner' is the implicit
// default for a classic 1:1 reach and is not a group audience.)
export type ReachAudience = 'owners' | 'guardians' | 'everyone';

export interface Reach {
  id: string;

  fromTreeId: string;
  toTreeId: string;

  pulseId: string;

  intent: "witness" | "learn" | "offer" | "request" | "align";

  status: "offered" | "accepted" | "declined";

  createdAt: Timestamp;
}
