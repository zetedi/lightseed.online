import type { Timestamp } from 'firebase/firestore';

export interface Reach {
  id: string;

  fromTreeId: string;
  toTreeId: string;

  pulseId: string;

  intent: "witness" | "learn" | "offer" | "request" | "align";

  status: "offered" | "accepted" | "declined";

  createdAt: Timestamp;
}
