// The view-hold — a soft, self-expiring lock so two guests don't reach for the same nights at
// once. It grants nothing and forbids nothing hard: it only tells the UI that another being is
// choosing right now. Expiry is by wall-clock timestamp, so a stale hold simply lapses — no
// sweep, no cleanup function, no way to hold a bed hostage.

export const HOLD_TTL_MS = 120000; // two minutes to choose the nights

export interface Hold {
  bedId: string;
  holderUid: string;
  expiresAt: number; // ms since epoch
}

export const holdIsActive = (hold: Pick<Hold, 'expiresAt'> | null | undefined, nowMs: number): boolean =>
  !!hold && hold.expiresAt > nowMs;

// Does ANOTHER being currently hold this bed? Your own hold never blocks you.
export const holdBlocks = (hold: Hold | null | undefined, uid: string, nowMs: number): boolean =>
  holdIsActive(hold, nowMs) && hold!.holderUid !== uid;
