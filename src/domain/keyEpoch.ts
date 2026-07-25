// THE KEY-EPOCH LAW — pure time and lineage semantics for the signing crystal.
//
// A key is not simply "valid" or "revoked". A seal belongs to a moment:
//   - an anchored epoch says when a key became eligible to speak;
//   - rotation retires the old key without erasing what it truthfully sealed before;
//   - a freeze stops new speech immediately and may cast a bounded interval into dispute;
//   - witnessed recovery has the same temporal effect as a freeze + a new anchored epoch.
//
// This module deliberately knows nothing about Firestore or WebCrypto. Storage pins recordedAt to
// the server receipt time; services verify the cryptographic proofs; this law gives both one meaning.

export const KEY_EVENT_VERSION = 'lifeseed.key-event.v1';
export const KEY_ROTATION_DOMAIN = 'lifeseed.key-rotation.v1';
export const KEY_RECOVERY_DOMAIN = 'lifeseed.key-recovery.v1';
export const KEY_RECOVERY_QUORUM = 3;

export type KeyEventType = 'anchor' | 'rotate' | 'freeze' | 'recover';

export interface KeyEpoch {
  epochId: string;
  fingerprint: string;
  anchoredAtMs: number;
}

export interface KeyEvent {
  eventId: string;
  type: KeyEventType;
  epochId: string;
  keyFingerprint: string;
  recordedAtMs: number;
  previousFingerprint?: string;
  // A socially authorised event may say the suspected compromise began before it was reported.
  // Client freeze records only an allegation under another field; witnessed recovery is what gives
  // this interval force. It is disputed, never silently erased, and cannot begin after recordedAt.
  suspectedSinceMs?: number;
}

export interface RecordedKeyUse {
  epochId?: string;
  keyFingerprint?: string;
  recordedAtMs?: number;
}

export type KeyStanding =
  | 'current'
  | 'historical'
  | 'disputed'
  | 'revoked_at_signing'
  | 'not_yet_valid'
  | 'unknown_epoch'
  | 'unanchored';

const terminalEventsFor = (
  fingerprint: string,
  events: readonly KeyEvent[],
): KeyEvent[] =>
  events
    .filter(event =>
      (event.type === 'rotate' || event.type === 'recover')
        ? event.previousFingerprint === fingerprint
        : event.type === 'freeze' && event.keyFingerprint === fingerprint,
    )
    .sort((a, b) => a.recordedAtMs - b.recordedAtMs);

// Judge a key at the RECEIPT TIME of the seal. The time is not claimed to be the exact instant a
// private key was used; it is the first server-witnessed instant at which that use entered history.
export function keyStandingAt(
  use: RecordedKeyUse,
  epochs: readonly KeyEpoch[],
  events: readonly KeyEvent[],
  currentFingerprint: string,
): KeyStanding {
  if (!use.epochId || !use.keyFingerprint || use.recordedAtMs === undefined) return 'unanchored';

  const epoch = epochs.find(candidate => candidate.epochId === use.epochId);
  if (!epoch || epoch.fingerprint !== use.keyFingerprint) return 'unknown_epoch';
  if (use.recordedAtMs < epoch.anchoredAtMs) return 'not_yet_valid';

  const terminalEvents = terminalEventsFor(use.keyFingerprint, events);
  if (terminalEvents.length) {
    const stoppedAt = terminalEvents[0].recordedAtMs;
    // A later witnessed recovery may socially confirm that compromise began before an earlier
    // unilateral freeze. The freeze stops speech immediately; the witnessed event alone gives the
    // earlier allegation authority over history.
    const disputedSince = terminalEvents
      .flatMap(event =>
        event.suspectedSinceMs !== undefined && event.suspectedSinceMs <= event.recordedAtMs
          ? [event.suspectedSinceMs] : [],
      )
      .sort((a, b) => a - b)[0];
    if (
      disputedSince !== undefined
      && use.recordedAtMs >= disputedSince
      && use.recordedAtMs < stoppedAt
    ) return 'disputed';
    if (use.recordedAtMs >= stoppedAt) return 'revoked_at_signing';
  }

  return use.keyFingerprint === currentFingerprint && !terminalEvents.length ? 'current' : 'historical';
}

// A disputed seal remains visible as a historically possible act, but it must not silently satisfy
// a new quorum. Re-affirmation is how a new trusted epoch gives it present assurance.
export function keyStandingCounts(standing: KeyStanding): boolean {
  return standing === 'current' || standing === 'historical';
}

export interface KeyRotationClaim {
  uid: string;
  lid: string;
  eventId: string;
  fromFingerprint: string;
  toFingerprint: string;
}

export interface KeyRecoveryClaim extends KeyRotationClaim {
  suspectedSinceMs: number;
}

// Fixed-field preimages keep browser and callable verification byte-identical without importing app
// code into the functions package. Values cannot contain newlines: ids/fingerprints are validated at
// the boundary before either function is used.
export function keyRotationPreimage(claim: KeyRotationClaim): string {
  return [
    KEY_EVENT_VERSION,
    KEY_ROTATION_DOMAIN,
    claim.uid,
    claim.lid,
    claim.eventId,
    claim.fromFingerprint,
    claim.toFingerprint,
  ].join('\n');
}

export function keyRecoveryPreimage(claim: KeyRecoveryClaim): string {
  return [
    KEY_EVENT_VERSION,
    KEY_RECOVERY_DOMAIN,
    claim.uid,
    claim.lid,
    claim.eventId,
    claim.fromFingerprint,
    claim.toFingerprint,
    String(claim.suspectedSinceMs),
  ].join('\n');
}

export function keyRecoveryWitnessPreimage(
  claim: KeyRecoveryClaim,
  witnessUid: string,
): string {
  return [
    KEY_EVENT_VERSION,
    KEY_RECOVERY_DOMAIN,
    'witness',
    witnessUid,
    claim.uid,
    claim.lid,
    claim.eventId,
    claim.fromFingerprint,
    claim.toFingerprint,
    String(claim.suspectedSinceMs),
  ].join('\n');
}

export function recoveryQuorumMet(witnessUids: readonly string[]): boolean {
  return new Set(witnessUids.filter(Boolean)).size >= KEY_RECOVERY_QUORUM;
}
