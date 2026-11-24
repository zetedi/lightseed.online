import { describe, expect, it } from 'vitest';
import { charterCustodyOf, SEED_API_UID } from '../src/domain/seedInstall.mjs';

describe('who can read the charter the installer writes', () => {
  it('leaves it as it is where the container\'s hand is the installing account', () => {
    expect(charterCustodyOf({ platform: 'linux', uid: SEED_API_UID })).toEqual({ action: 'as_is' });
  });
  it('leaves it as it is where Docker\'s own machine maps ownership', () => {
    for (const platform of ['darwin', 'win32']) expect(charterCustodyOf({ platform, uid: 501 })).toEqual({ action: 'as_is' });
    expect(charterCustodyOf({ platform: 'linux', uid: 1001, dockerDesktop: true })).toEqual({ action: 'as_is' });
  });
  it('gives it to the API\'s hand when the installer is root', () => {
    expect(charterCustodyOf({ platform: 'linux', uid: 0, securityOptions: ['name=apparmor', 'name=seccomp,profile=builtin'] })).toEqual({ action: 'give' });
  });
  it('refuses any other account on Linux, before anything is written', () => {
    for (const uid of [1, 999, 1001, 65534]) expect(charterCustodyOf({ platform: 'linux', uid })).toEqual({ action: 'refuse', reason: 'foreign_account' });
  });
  it('refuses a rootless or remapped daemon, whoever installs', () => {
    for (const uid of [0, SEED_API_UID, 1001]) {
      expect(charterCustodyOf({ platform: 'linux', uid, securityOptions: ['name=seccomp,profile=builtin', 'name=rootless'] })).toEqual({ action: 'refuse', reason: 'remapped_daemon' });
      expect(charterCustodyOf({ platform: 'linux', uid, securityOptions: ['name=userns'] })).toEqual({ action: 'refuse', reason: 'remapped_daemon' });
    }
  });
});
