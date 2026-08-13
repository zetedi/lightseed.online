// THE CLOCK SEAM — the one place the domain names a stored moment (ring 2026-08-14).
// Entity interfaces used to import Firestore's Timestamp type directly, which chained the
// whole pure layer to one backend at the TYPE level (the last leak the @lightseed/domain
// extraction needs closed). Stamp is the structural contract instead: anything that can say
// its milliseconds and its Date. Firestore's Timestamp satisfies it without knowing us; any
// other backend supplies it in two lines. LAWS never take a Stamp — they take plain ms
// numbers (nowMs, revokedAtMs …), so determinism stays visible in every signature; Stamp
// exists only so ENTITY SHAPES can carry stored moments without naming a vendor.
export interface Stamp {
  toMillis(): number;
  toDate(): Date;
}

// The tolerant read every surface uses: absent stamp = 0 (serverTimestamp lands a breath
// later; an unsaved moment sorts first/last rather than throwing the list away).
export const msOf = (s?: Stamp | null): number => s?.toMillis?.() ?? 0;
