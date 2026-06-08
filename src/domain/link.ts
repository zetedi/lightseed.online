import type { Timestamp } from 'firebase/firestore';

export interface Link {
  id: string;

  treeIds: string[];

  createdAt: Timestamp;

  pulseCount: number;

  coherenceScore?: number;
}
