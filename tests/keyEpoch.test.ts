import { describe, expect, it } from 'vitest';
import {
  KEY_RECOVERY_QUORUM,
  keyRecoveryPreimage,
  keyRecoveryWitnessPreimage,
  keyRotationPreimage,
  keyStandingAt,
  keyStandingCounts,
  recoveryQuorumMet,
  type KeyEpoch,
  type KeyEvent,
} from '../src/domain/keyEpoch';

const OLD = 'a'.repeat(64);
const NEXT = 'b'.repeat(64);
const OLD_EPOCH: KeyEpoch = { epochId: 'epoch-old', fingerprint: OLD, anchoredAtMs: 100 };
const NEXT_EPOCH: KeyEpoch = { epochId: 'rotate-1', fingerprint: NEXT, anchoredAtMs: 500 };

describe('keyStandingAt — revocation has time, not amnesia', () => {
  it('recognises a current anchored key', () => {
    expect(keyStandingAt(
      { epochId: OLD_EPOCH.epochId, keyFingerprint: OLD, recordedAtMs: 200 },
      [OLD_EPOCH],
      [],
      OLD,
    )).toBe('current');
  });

  it('keeps a pre-rotation seal historically valid and rejects the old key after rotation', () => {
    const rotation: KeyEvent = {
      eventId: 'rotate-1',
      type: 'rotate',
      epochId: NEXT_EPOCH.epochId,
      keyFingerprint: NEXT,
      previousFingerprint: OLD,
      recordedAtMs: 500,
    };
    expect(keyStandingAt(
      { epochId: OLD_EPOCH.epochId, keyFingerprint: OLD, recordedAtMs: 499 },
      [OLD_EPOCH, NEXT_EPOCH],
      [rotation],
      NEXT,
    )).toBe('historical');
    expect(keyStandingAt(
      { epochId: OLD_EPOCH.epochId, keyFingerprint: OLD, recordedAtMs: 500 },
      [OLD_EPOCH, NEXT_EPOCH],
      [rotation],
      NEXT,
    )).toBe('revoked_at_signing');
  });

  it('a unilateral freeze stops speech; only later witnessed recovery gives an earlier suspicion force', () => {
    const freeze: KeyEvent = {
      eventId: 'freeze-1',
      type: 'freeze',
      epochId: OLD_EPOCH.epochId,
      keyFingerprint: OLD,
      recordedAtMs: 500,
    };
    const beforeWitnesses = (recordedAtMs: number) => keyStandingAt(
      { epochId: OLD_EPOCH.epochId, keyFingerprint: OLD, recordedAtMs },
      [OLD_EPOCH],
      [freeze],
      OLD,
    );
    expect(beforeWitnesses(350)).toBe('historical');
    expect(beforeWitnesses(499)).toBe('historical');
    expect(beforeWitnesses(500)).toBe('revoked_at_signing');

    const recovery: KeyEvent = {
      eventId: 'recover-1',
      type: 'recover',
      epochId: NEXT_EPOCH.epochId,
      keyFingerprint: NEXT,
      previousFingerprint: OLD,
      suspectedSinceMs: 350,
      recordedAtMs: 700,
    };
    const afterWitnesses = (recordedAtMs: number) => keyStandingAt(
      { epochId: OLD_EPOCH.epochId, keyFingerprint: OLD, recordedAtMs },
      [OLD_EPOCH, NEXT_EPOCH],
      [freeze, recovery],
      NEXT,
    );
    expect(afterWitnesses(349)).toBe('historical');
    expect(afterWitnesses(350)).toBe('disputed');
    expect(afterWitnesses(499)).toBe('disputed');
    expect(afterWitnesses(500)).toBe('revoked_at_signing');
  });

  it('refuses invented, mismatched, pre-anchor, and timeless epochs', () => {
    expect(keyStandingAt(
      { epochId: 'invented', keyFingerprint: OLD, recordedAtMs: 200 },
      [OLD_EPOCH],
      [],
      OLD,
    )).toBe('unknown_epoch');
    expect(keyStandingAt(
      { epochId: OLD_EPOCH.epochId, keyFingerprint: NEXT, recordedAtMs: 200 },
      [OLD_EPOCH],
      [],
      NEXT,
    )).toBe('unknown_epoch');
    expect(keyStandingAt(
      { epochId: OLD_EPOCH.epochId, keyFingerprint: OLD, recordedAtMs: 99 },
      [OLD_EPOCH],
      [],
      OLD,
    )).toBe('not_yet_valid');
    expect(keyStandingAt(
      { keyFingerprint: OLD, recordedAtMs: 200 },
      [OLD_EPOCH],
      [],
      OLD,
    )).toBe('unanchored');
  });

  it('counts only assured current or historical seals', () => {
    expect(keyStandingCounts('current')).toBe(true);
    expect(keyStandingCounts('historical')).toBe(true);
    for (const standing of ['disputed', 'revoked_at_signing', 'not_yet_valid', 'unknown_epoch', 'unanchored'] as const) {
      expect(keyStandingCounts(standing)).toBe(false);
    }
  });
});

describe('key transition claims', () => {
  const base = {
    uid: 'being-1',
    lid: '019c-being-lid',
    eventId: 'event-1',
    fromFingerprint: OLD,
    toFingerprint: NEXT,
  };

  it('binds rotation proofs to the being, event, and both keys', () => {
    const preimage = keyRotationPreimage(base);
    expect(preimage).toContain('lifeseed.key-rotation.v1');
    expect(keyRotationPreimage({ ...base, toFingerprint: 'c'.repeat(64) })).not.toBe(preimage);
    expect(keyRotationPreimage({ ...base, uid: 'being-2' })).not.toBe(preimage);
  });

  it('binds recovery witnesses to the suspected-compromise boundary', () => {
    const preimage = keyRecoveryPreimage({ ...base, suspectedSinceMs: 400 });
    expect(preimage).toContain('lifeseed.key-recovery.v1');
    expect(keyRecoveryPreimage({ ...base, suspectedSinceMs: 401 })).not.toBe(preimage);
    expect(keyRecoveryWitnessPreimage({ ...base, suspectedSinceMs: 400 }, 'alice'))
      .not.toBe(keyRecoveryWitnessPreimage({ ...base, suspectedSinceMs: 400 }, 'bob'));
  });

  it(`requires ${KEY_RECOVERY_QUORUM} distinct witnesses`, () => {
    expect(recoveryQuorumMet(['a', 'b'])).toBe(false);
    expect(recoveryQuorumMet(['a', 'a', 'b'])).toBe(false);
    expect(recoveryQuorumMet(['a', 'b', 'c'])).toBe(true);
  });
});
