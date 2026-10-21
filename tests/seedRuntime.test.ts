import { describe, expect, it } from 'vitest';
import { seedRuntimeSql } from '../src/domain/seedRuntime';

const verifier = `SCRAM-SHA-256$4096:${'a'.repeat(22)}==$${'b'.repeat(43)}=:${'c'.repeat(43)}=`;
describe('runtime account contract', () => {
  it('accepts only generated names and SCRAM verifiers, never arbitrary SQL or clear passwords', () => {
    expect(seedRuntimeSql('lightseed_api_0123456789abcdef', verifier)).not.toBeNull();
    for (const role of ['postgres', 'lightseed', 'lightseed_api_', 'lightseed_api_0123456789abcdef;--']) {
      expect(seedRuntimeSql(role, verifier)).toBeNull();
    }
    for (const value of ['clear-password', verifier + "'; SELECT 1;--", verifier.replace('4096', '1')]) {
      expect(seedRuntimeSql('lightseed_api_0123456789abcdef', value)).toBeNull();
    }
  });
});
