import { describe, it, expect } from 'vitest';
import { pictureReleaseOf, pictureReleaseOfUrl, docReferencesPicture } from '../src/domain/pictureRelease';
import { pictureReleaseOf as sPictureReleaseOf, docReferencesPicture as sDocReferencesPicture } from '../functions/src/pictureRelease';

// The release of a picture (ring 2026-09-08): only the appearance seats, never what a chain binds.
describe('pictureReleaseOf — the seats that may be released, and what goes with them', () => {
  it("a community's logo, hero, gallery and pages — held by the community", () => {
    for (const p of ['communities/c1/logo_1788812960545.webp', 'communities/c1/hero_1.jpg', 'communities/c1/1788000000000.webp', 'communities/c1/1788000000000', 'communities/c1/pages/1788.webp']) {
      const r = pictureReleaseOf(p);
      expect(r?.holder).toEqual({ kind: 'community', id: 'c1' });
      expect(r?.objects).toEqual([p, `thumbs/${p}@480.webp`, `thumbs/${p}@1200.webp`, `originals/${p}`]);
    }
  });
  it("a person's site logo and hero — held by the person", () => {
    expect(pictureReleaseOf('users/u1/site-theme/logo_1.webp')?.holder).toEqual({ kind: 'user', uid: 'u1' });
  });
  it('never what a chain binds, never a derived object, never a stranger path', () => {
    for (const p of ['communities/c1/events/1.webp', 'communities/c1/lightHouses/x.webp', 'users/u1/pulses/ai/1.webp', 'users/u1/trees/ai/1.webp', 'users/u1/watering/t/1.webp', 'users/u1/offerings/1.webp', 'beings/l1/anything.webp', 'thumbs/communities/c1/logo_1.webp@480.webp', 'originals/communities/c1/logo_1.webp', 'communities/../x', '']) {
      expect(pictureReleaseOf(p), p).toBeNull();
    }
  });
  it('reads a download URL, and only ours', () => {
    const url = 'https://firebasestorage.googleapis.com/v0/b/b.app/o/communities%2Fc1%2Flogo_1.webp?alt=media&token=t';
    expect(pictureReleaseOfUrl(url)?.holder).toEqual({ kind: 'community', id: 'c1' });
    expect(pictureReleaseOfUrl('https://elsewhere.example/logo.webp')).toBeNull();
  });
});

describe('docReferencesPicture — the holder still shows it, at any depth, raw or encoded', () => {
  const path = 'communities/c1/hero_1.webp';
  const url = `https://firebasestorage.googleapis.com/v0/b/b.app/o/${encodeURIComponent(path)}?alt=media`;
  it('finds it in a field, an array, a page\'s html; misses when gone', () => {
    expect(docReferencesPicture({ heroImageUrl: url }, path)).toBe(true);
    expect(docReferencesPicture({ imageUrls: ['x', url] }, path)).toBe(true);
    expect(docReferencesPicture({ landingPages: [{ html: `<img src="${url}">` }] }, path)).toBe(true);
    expect(docReferencesPicture({ heroImageUrl: '', imageUrls: [] }, path)).toBe(false);
    expect(docReferencesPicture(null, path)).toBe(false);
  });
});

describe('the functions mirror stays true', () => {
  it('names the same holders and objects, and reads references alike', () => {
    for (const p of ['communities/c1/logo_1.webp', 'users/u1/site-theme/hero_2.jpg', 'communities/c1/events/1.webp', 'thumbs/x@480.webp']) {
      expect(sPictureReleaseOf(p)).toEqual(pictureReleaseOf(p));
    }
    const doc = { a: [{ b: 'https://x/o/communities%2Fc1%2Flogo_1.webp' }] };
    expect(sDocReferencesPicture(doc, 'communities/c1/logo_1.webp')).toBe(docReferencesPicture(doc, 'communities/c1/logo_1.webp'));
  });
});
