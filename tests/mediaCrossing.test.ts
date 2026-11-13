// THE MEDIA CROSSES (ring 2026-11-03): the pictures the records name travel beside the bundle, their census
// sealed into the head, every file answering to its own name; what is named but not held is named as left.
import { describe, expect, it } from 'vitest';
import { mediaReferencedBy, mediaHashesOf, mediaSidecarOf, mediaDigestOf, mediaHeadOf, mediaSidecarIssues, mediaConflictsOf } from '../src/domain/mediaCrossing';

const H = (n: number) => n.toString(16).padStart(64, '0');
const descriptor = (n: number, type = 'image/webp') => ({ hash: H(n), type, size: 1000 + n });
const manifest = (path: string, n: number) => ({ path, doc: { primary: descriptor(n, 'image/png'), small: descriptor(n + 1), large: descriptor(n + 2) } });

describe('the media crossing', () => {
  it('finds every picture the records name, raw or encoded, however deep', () => {
    const docs = [
      { path: 'communities/c1', data: { logoUrl: '/v1/media?path=communities%2Fc1%2Flogo_1.webp', papers: [{ html: '<img src="/v1/media?path=communities/c1/hero_1.webp">' }] } },
      { path: 'users/u1', data: { photoURL: 'https://firebasestorage.googleapis.com/v0/b/x/o/users%2Fu1%2Fa.png?alt=media', site: { theme: { logo: '/v1/media?path=users%2Fu1%2Fsite-theme%2Flogo_1.webp' } } } },
      { path: 'pulses/p1', data: { imageUrl: '/v1/media?path=users%2Fu1%2Fpulses%2Fai%2F1-0.webp&variant=small', n: 3, flag: true } },
    ];
    expect([...mediaReferencedBy(docs)].sort()).toEqual(['communities/c1/logo_1.webp', 'users/u1/site-theme/logo_1.webp']);
  });
  it('carries the referenced manifests alone, their distinct files sorted, and names what is missing', async () => {
    const held = [manifest('communities/c1/logo_1.webp', 1), manifest('communities/c1/hero_9.webp', 4), { path: 'broken', doc: { primary: { hash: 'nope' } } } as never];
    const sidecar = mediaSidecarOf(held, new Set(['communities/c1/logo_1.webp', 'communities/c1/gone.webp', 'broken']));
    expect(sidecar.manifests.map(m => m.path)).toEqual(['communities/c1/logo_1.webp']);
    expect(sidecar.hashes).toEqual([H(1), H(2), H(3)]);
    expect(sidecar.left).toEqual(['broken', 'communities/c1/gone.webp']);
    expect(mediaHashesOf([manifest('a', 1), manifest('b', 1)])).toEqual([H(1), H(2), H(3)]); // shared bytes, one file
    const head = await mediaHeadOf(sidecar);
    expect(head).toEqual({ manifests: 1, files: 3, digest: await mediaDigestOf(sidecar.manifests) });
    expect(await mediaDigestOf([manifest('b', 4), manifest('a', 1)])).toBe(await mediaDigestOf([manifest('a', 1), manifest('b', 4)]));
    expect(await mediaDigestOf([manifest('a', 1)])).not.toBe(await mediaDigestOf([manifest('a', 2)]));
  });
  it('holds the sidecar to the sealed head and to every file by name', async () => {
    const manifests = [manifest('communities/c1/logo_1.webp', 1)];
    const head = await mediaHeadOf({ manifests, hashes: mediaHashesOf(manifests), left: [] });
    const all = async () => true;
    expect(await mediaSidecarIssues(head, manifests, all)).toEqual([]);
    expect((await mediaSidecarIssues(undefined, manifests, all)).map(i => i.code)).toEqual(['media_head_missing']);
    expect((await mediaSidecarIssues(head, [...manifests, manifest('x', 7)], all)).map(i => i.code)).toEqual(['media_count', 'media_digest']);
    expect((await mediaSidecarIssues(head, [manifest('communities/c1/logo_1.webp', 2)], all)).map(i => i.code)).toEqual(['media_digest']);
    expect(await mediaSidecarIssues(head, manifests, async hash => hash !== H(2))).toEqual([{ code: 'media_file_missing', detail: H(2) }]);
    expect((await mediaSidecarIssues(head, [{ path: 'communities/c1/logo_1.webp', doc: { primary: 1 } }] as never, all)).map(i => i.code)).toEqual(['media_manifest_unsound']);
  });
  it('plans a different picture standing at a bundle path as a conflict, and the same picture as nothing', () => {
    const standing = [manifest('a', 1), manifest('b', 4)];
    expect(mediaConflictsOf([manifest('a', 1), manifest('c', 7)], standing)).toEqual([]); // same files at a, nothing at c
    expect(mediaConflictsOf([manifest('b', 1)], standing)).toEqual([{ code: 'media_conflict', path: 'b', detail: 'A different picture already stands at this path on this node.' }]);
    expect(mediaConflictsOf([{ path: 'a', doc: { ...manifest('a', 1).doc, large: descriptor(9) } }], standing)).toHaveLength(1); // one variant swapped is another picture
  });
});
