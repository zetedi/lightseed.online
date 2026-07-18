import { describe, it, expect } from 'vitest';
import { beingPath, beingUrl, isQrStale, lidFromPath } from '../src/domain/beingLink';

// The being link — the QR's spine: lid in, URL out, staleness when the domain moves.

const LID = '018f6b2a-7c3e-7d90-b1aa-3e5f8c2d4e6f';

describe('beingUrl', () => {
  it('builds the /b/<lid> door on any origin', () => {
    expect(beingPath(LID)).toBe(`/b/${LID}`);
    expect(beingUrl(LID, 'https://lifeseed.online')).toBe(`https://lifeseed.online/b/${LID}`);
    expect(beingUrl(LID, 'https://perauset.com/')).toBe(`https://perauset.com/b/${LID}`); // trailing slash tolerated
  });
});

describe('isQrStale — paper remembers where it was printed', () => {
  it('a mint on the current domain is fresh', () => {
    expect(isQrStale(`https://perauset.com/b/${LID}`, LID, 'https://perauset.com')).toBe(false);
  });
  it('a mint from another domain is stale', () => {
    expect(isQrStale(`https://perauset.web.app/b/${LID}`, LID, 'https://perauset.com')).toBe(true);
  });
  it('no mint yet means nothing to be stale', () => {
    expect(isQrStale(undefined, LID, 'https://perauset.com')).toBe(false);
  });
});

describe('lidFromPath', () => {
  it('reads the lid out of a scanned path, trailing slash tolerated', () => {
    expect(lidFromPath(`/b/${LID}`)).toBe(LID);
    expect(lidFromPath(`/b/${LID}/`)).toBe(LID);
  });
  it('ignores everything else', () => {
    expect(lidFromPath('/')).toBeNull();
    expect(lidFromPath('/model')).toBeNull();
    expect(lidFromPath('/b/')).toBeNull();
    expect(lidFromPath('/b/short')).toBeNull();
  });
});
