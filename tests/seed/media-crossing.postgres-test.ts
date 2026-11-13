// THE MEDIA CROSSES against real PostgreSQL (ring 2026-11-03): a node's pictures leave beside the bundle, their
// census under the custodian's seal, each file verified by its own name on the far shore, the files landed
// before the records and the manifests with them in one transaction — a swapped file refused.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { startCluster, type Cluster } from './harness';
import { createMediaStore } from '../../seed/api/media.mjs';
import { ownerClient, readSnapshot, readMediaManifests, buildBundle, custodianOf, sealBundle, cross, writeMediaSidecar, readMediaSidecar, mediaFilePresent, landMediaFiles } from '../../seed/api/bundle.mjs';
import { mediaReferencedBy, mediaSidecarOf, mediaHeadOf, mediaSidecarIssues, mediaHashesOf } from '../../src/domain/mediaCrossing';

let cluster: Cluster;
beforeAll(() => { cluster = startCluster(55452); });
afterAll(() => cluster.stop());

const LID = (n: number) => `019a0000-0000-7000-8000-${String(n).padStart(12, '0')}`;
const pem = () => generateKeyPairSync('ed25519').privateKey.export({ format: 'pem', type: 'pkcs8' }) as string;
const sharp = createRequire(resolve('seed/package.json'))('sharp');
const picture = (seed: number): Promise<Buffer> => sharp({ create: { width: 640, height: 400, channels: 3, background: { r: (seed * 37) % 256, g: (seed * 91) % 256, b: 90 } } }).png().toBuffer();
const charter = { ...JSON.parse(readFileSync(resolve('seed/node.example.json'), 'utf8')), nodeLid: LID(900) };
const hashes = { genesisMd: '0'.repeat(64), linMd: '1'.repeat(64) };

describe('the media crossing', () => {
  it('carries the pictures the records name, verifies each file by name, lands files before records and manifests with them', async () => {
    const root = mkdtempSync('/tmp/lightseed-media-crossing-');
    const source = await cluster.fresh(1), target = await cluster.fresh(1);
    const src = ownerClient(source.connection); await src.connect();
    const dst = ownerClient(target.connection); await dst.connect();
    try {
      // The source soil: two pictures in the store, one named by a record, one orphaned.
      const sourceStore = await createMediaStore(join(root, 'source'));
      const named = await sourceStore.encode(await picture(1), 'image/png');
      const orphan = await sourceStore.encode(await picture(2), 'image/png');
      // The cluster's own psql hand points at the LAST database made (the target): the source is seeded by its owner client.
      await src.query(`
        INSERT INTO users VALUES ('alice','{"lid":"${LID(1)}","displayName":"Alice","photoURL":"/v1/media?path=users%2Falice%2Fphoto_1.png"}');
        INSERT INTO persons VALUES ('alice','{"uid":"alice","lid":"${LID(1)}"}');
        INSERT INTO seed.media_objects VALUES ('users/alice/photo_1.png','${JSON.stringify(named)}'), ('users/alice/old_1.png','${JSON.stringify(orphan)}');`);
      const custodian = custodianOf(pem());
      const anchor = { fingerprint: custodian.fingerprint, publicKeyB64: custodian.publicKeyB64 };
      const snapshot = await readSnapshot(src);
      const sidecar = mediaSidecarOf(await readMediaManifests(src), mediaReferencedBy(snapshot));
      expect(sidecar.manifests.map(m => m.path)).toEqual(['users/alice/photo_1.png']);
      expect(sidecar.hashes).toEqual(mediaHashesOf(sidecar.manifests));
      expect(sidecar.left).toEqual([]);
      const media = await mediaHeadOf(sidecar);
      const bundle = sealBundle(await buildBundle({ snapshot, charter, exportCommit: 'd'.repeat(40), charterHashes: hashes, media }), custodian);
      expect(bundle.head.media).toEqual({ manifests: 1, files: 3, digest: media.digest });
      const beside = join(root, 'bundle.media');
      await writeMediaSidecar(beside, sidecar, join(root, 'source'));
      expect(readdirSync(beside).sort()).toEqual([...sidecar.hashes, 'manifests.json'].sort());
      await expect(writeMediaSidecar(beside, sidecar, join(root, 'source'))).rejects.toMatchObject({ code: 'EEXIST' }); // never into an existing directory

      // The far shore: the sidecar held to the sealed head and to every file's name.
      const manifests = await readMediaSidecar(beside);
      expect(await mediaSidecarIssues(bundle.head.media, manifests, mediaFilePresent(beside))).toEqual([]);
      const swapped = join(root, 'swapped');
      await writeMediaSidecar(swapped, sidecar, join(root, 'source'));
      writeFileSync(join(swapped, sidecar.hashes[0]), Buffer.from('not the same bytes'));
      expect((await mediaSidecarIssues(bundle.head.media, manifests, mediaFilePresent(swapped))).map(i => i.code)).toEqual(['media_file_missing']);
      expect((await mediaSidecarIssues(undefined, manifests, mediaFilePresent(beside))).map(i => i.code)).toEqual(['media_head_missing']);

      // The files first, then the crossing with the manifests inside it.
      const targetStoreDir = join(root, 'target');
      expect(await landMediaFiles(beside, targetStoreDir, sidecar.hashes)).toEqual(sidecar.hashes);
      expect(await landMediaFiles(beside, targetStoreDir, sidecar.hashes)).toEqual([]); // already there, by name
      await expect(landMediaFiles(swapped, join(root, 'elsewhere'), sidecar.hashes)).rejects.toMatchObject({ code: 'media_unsound' }); // held to its name as it is written
      await dst.query("INSERT INTO seed.identity_bindings(issuer,subject,uid,binding_kind) VALUES ('https://issuer.example','s-alice','alice','explicit')");
      // A different picture already standing at the same path on the shore blocks the crossing before anything lands (the review's mending).
      await dst.query(`INSERT INTO seed.media_objects VALUES ('users/alice/photo_1.png','${JSON.stringify(orphan)}')`);
      const blocked = await cross(dst, { incoming: bundle, anchor, identities: [{ sourceUid: 'alice', targetUid: 'alice', personLid: LID(1) }], apply: true, media: manifests });
      expect(blocked.applied).toBe(false);
      expect(blocked.plan.issues).toEqual([{ code: 'media_conflict', path: 'users/alice/photo_1.png', detail: 'A different picture already stands at this path on this node.' }]);
      await dst.query("DELETE FROM seed.media_objects WHERE path='users/alice/photo_1.png'");
      const crossing = await cross(dst, { incoming: bundle, anchor, identities: [{ sourceUid: 'alice', targetUid: 'alice', personLid: LID(1) }], apply: true, media: manifests });
      expect(crossing.plan.issues).toEqual([]);
      expect(crossing.applied).toBe(true); expect(crossing.inserted).toBe(2); expect(crossing.pictures).toBe(1);
      expect((await dst.query('SELECT path FROM seed.media_objects ORDER BY path')).rows.map((r: { path: string }) => r.path)).toEqual(['users/alice/photo_1.png']);
      expect((await dst.query("SELECT doc->>'pictures' AS pictures FROM seed.crossings")).rows[0].pictures).toBe('1');
      // The runtime role serves the picture by its door, and the store holds the bytes by name.
      const served = await target.db.mediaGet('users/alice/photo_1.png');
      expect(served).toEqual(named);
      const targetStore = await createMediaStore(targetStoreDir);
      expect(await targetStore.present(named)).toBe(true);
      expect((await targetStore.read(named.primary)).length).toBe(named.primary.size);
      // The same bundle again: nothing lands twice, the pictures neither.
      const again = await cross(dst, { incoming: bundle, anchor, identities: [{ sourceUid: 'alice', targetUid: 'alice', personLid: LID(1) }], apply: true, media: manifests });
      expect(again.inserted).toBe(0); expect(again.pictures).toBe(0); expect(again.already).toBeTruthy();
    } finally { await src.end(); await dst.end(); await source.db.close(); await target.db.close(); rmSync(root, { recursive: true, force: true }); }
  });
});
