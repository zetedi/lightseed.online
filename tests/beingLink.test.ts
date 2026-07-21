import { describe, it, expect } from 'vitest';
import { beingPath, beingUrl, isQrStale, lidFromPath } from '../src/domain/beingLink';
import { toBase62, LID62_LENGTH } from '../src/domain/lid62';

// The being link — the QR's spine: lid in, URL out, staleness when the domain moves.
// Doors are minted compact (base62); both door shapes open to the canonical lid.

const LID = '018f6b2a-7c3e-7d90-b1aa-3e5f8c2d4e6f';
const COMPACT = toBase62(LID);

describe('beingUrl — minted compact', () => {
  it('builds the short /b/<base62> door on any origin', () => {
    expect(beingPath(LID)).toBe(`/b/${COMPACT}`);
    expect(COMPACT).toHaveLength(LID62_LENGTH);
    expect(beingUrl(LID, 'https://lifeseed.online')).toBe(`https://lifeseed.online/b/${COMPACT}`);
    expect(beingUrl(LID, 'https://perauset.com/')).toBe(`https://perauset.com/b/${COMPACT}`); // trailing slash tolerated
  });
});

describe('isQrStale — paper remembers where it was printed', () => {
  it('a compact mint on the current domain is fresh', () => {
    expect(isQrStale(`https://perauset.com/b/${COMPACT}`, LID, 'https://perauset.com')).toBe(false);
  });
  it('a mint from another domain is stale', () => {
    expect(isQrStale(`https://perauset.web.app/b/${COMPACT}`, LID, 'https://perauset.com')).toBe(true);
  });
  it('a canonical-form mint from before the compact door is stale (re-mint shortens it)', () => {
    expect(isQrStale(`https://perauset.com/b/${LID}`, LID, 'https://perauset.com')).toBe(true);
  });
  it('no mint yet means nothing to be stale', () => {
    expect(isQrStale(undefined, LID, 'https://perauset.com')).toBe(false);
  });
});

describe('lidFromPath — both door shapes open to the canonical name', () => {
  it('reads the compact door, trailing slash tolerated', () => {
    expect(lidFromPath(`/b/${COMPACT}`)).toBe(LID);
    expect(lidFromPath(`/b/${COMPACT}/`)).toBe(LID);
  });
  it('still reads every canonical door already printed on paper', () => {
    expect(lidFromPath(`/b/${LID}`)).toBe(LID);
    expect(lidFromPath(`/b/${LID}/`)).toBe(LID);
  });
  it('ignores everything else', () => {
    expect(lidFromPath('/')).toBeNull();
    expect(lidFromPath('/model')).toBeNull();
    expect(lidFromPath('/b/')).toBeNull();
    expect(lidFromPath('/b/short')).toBeNull();
    expect(lidFromPath(`/b/${'!'.repeat(22)}`)).toBeNull();
  });
});
