// THE REFUSALS A SIGNING HAND CAN SPEAK (lifted from services/firebase/keys on 2026-11-01 so both
// backends throw the very same classes and every `instanceof` in the shell stays true).

// Thrown when this device cannot sign under the PUBLISHED identity:
//   'needs_restore' — this device holds NO key but an identity key is published. Silently minting a
//       fresh keypair would replace it; the being must restore from the phrase or use witnessed
//       recovery after freezing the old epoch.
//   'stale_device'  — this device holds a key, but a DIFFERENT identity key is published (another
//       device rotated). Republishing the local key would hijack the identity back; it is refused.
export class SigningKeyNeedsRestoreError extends Error {
  readonly code = 'needs-restore' as const;
  constructor(readonly reason: 'needs_restore' | 'stale_device' = 'needs_restore') {
    super(reason === 'stale_device'
      ? 'This device holds an older signing key than the one published for this account. Restore your current recovery phrase here.'
      : 'A signing key is already published for this account, but this device holds no key. Restore it from your recovery phrase.');
    this.name = 'SigningKeyNeedsRestoreError';
  }
}

// Thrown by restoreFromPhrase when the phrase is VALID BIP39 but derives a key that is NOT the
// published identity key — a different phrase than the one backing this account. Installing it
// would silently replace the published identity (the exact bypass the needs_restore warning
// guards), so it is refused. A different key enters only by cross-signed rotation or witnessed
// recovery, never through this restore path.
export class RestoreKeyMismatchError extends Error {
  readonly code = 'restore-mismatch' as const;
  constructor() {
    super('This recovery phrase restores a DIFFERENT key than the one published for this identity. Check the phrase; replacement needs cross-signed rotation or witnessed recovery.');
    this.name = 'RestoreKeyMismatchError';
  }
}

export class SigningKeyFrozenError extends Error {
  readonly code = 'signing-key-frozen' as const;
  constructor() {
    super('This signing key is frozen. It cannot make new seals; recovery needs witnessed authority.');
    this.name = 'SigningKeyFrozenError';
  }
}
