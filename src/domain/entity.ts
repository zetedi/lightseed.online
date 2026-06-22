import type { Timestamp } from 'firebase/firestore';

// The shared base every being extends — a Living Identity (lid) and a birth time.
// See memory/lid-lin-entity: LID = the per-entity UUIDv7 true-name; LIN = the network the
// links between LIDs form. No `type` discriminator here — Pulse/Lifetree already carry their
// own `type` unions, and the unified Entity collapse is deferred (Phase 2).
export interface Entity {
  lid?: string;        // Lightseed ID — portable, time-ordered UUIDv7 true-name (utils/id.ts).
  createdAt: Timestamp;
}
