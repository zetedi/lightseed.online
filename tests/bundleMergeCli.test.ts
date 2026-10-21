import { describe, expect, it } from 'vitest';
import { mkdtemp, writeFile, readFile, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { buildCensus, manifestHashOf, BUNDLE_SEAL_TAG, type CharterHead } from '../src/domain/bundle';
import { signingPreimage } from '../src/domain/signing';

describe('offline merge command', () => {
  it('verifies a real signature, writes a private report, refuses overwrite and reports tampering', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'lightseed-merge-'));
    try {
      const { publicKey, privateKey } = generateKeyPairSync('ed25519');
      const publicKeyB64 = publicKey.export({ format: 'der', type: 'spki' }).toString('base64');
      const fingerprint = createHash('sha256').update(publicKeyB64).digest('hex');
      const docs = [{ path: 'lifetrees/example', data: { name: 'Oak' } }];
      const head: CharterHead = {
        formatVersion: 1, nodeLid: '019f6381-48fd-7fcc-9382-e99d923f38aa',
        domain: 'source.example', exportedAtMs: 1, exportCommit: 'test',
        charterHashes: { genesisMd: 'genesis', linMd: 'lin' },
        genesisTree: null, census: await buildCensus(docs),
      };
      const manifestHash = await manifestHashOf(head);
      const signature = sign(null, Buffer.from(signingPreimage(BUNDLE_SEAL_TAG, manifestHash)), privateKey).toString('base64');
      const incoming = { head, manifestHash, docs, seal: { fingerprint, signature } };
      const files = ['source.json', 'destination.json', 'anchor.json', 'identities.json', 'report.json'].map(f => join(directory, f));
      await Promise.all([incoming, [], { fingerprint, publicKeyB64 }, []].map((v, i) => writeFile(files[i], JSON.stringify(v))));
      const run = () => spawnSync(process.execPath, [resolve('scripts/plan-node-merge.mjs'), ...files], {
        encoding: 'utf8', timeout: 20_000,
      });
      const first = run();
      expect(first.status, first.stderr).toBe(0);
      expect(JSON.parse(await readFile(files[4], 'utf8')).inserts).toEqual(docs);
      expect((await stat(files[4])).mode & 0o777).toBe(0o600);
      expect(run().status).toBe(1);
      await rm(files[4]);
      incoming.docs[0].data.name = 'Tampered';
      await writeFile(files[0], JSON.stringify(incoming));
      const tampered = run();
      expect(tampered.status, tampered.stderr).toBe(2);
      const report = JSON.parse(await readFile(files[4], 'utf8'));
      expect(report.ready).toBe(false);
      expect(report.inserts).toEqual([]);
      expect(report.issues[0].code).toBe('invalid_bundle');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }, 60_000);
});
