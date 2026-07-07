import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateKeyPairSync, sign as edSign, type KeyObject } from 'node:crypto';

// The three-sponsor rule as math — these tests run the REAL verifier (scripts/verify-initiations.mjs)
// against fixture ledgers built with real ed25519 keys. Every attack the verifier exists to stop
// must stay stopped: forged signatures, re-pointed uids/lids, self-declared genesis.

const SIG = 'lightseed.initiation.v1';
const SCRIPT = join(__dirname, '..', 'scripts', 'verify-initiations.mjs');

const pubB64 = (k: KeyObject) => (k.export({ format: 'der', type: 'spki' }) as Buffer).toString('base64');
const msg = (handle: string, pubkey: string, lid = '', uid = '', visionId = '') =>
  Buffer.from([SIG, handle, pubkey, lid, uid, visionId].join('\n'), 'utf8');

// UUIDv7 for fixture lids (same shape the app mints).
const uuidv7 = (at = 1783382400000) => {
  const b = new Uint8Array(16);
  let t = at;
  for (let i = 5; i >= 0; i--) { b[i] = t % 256; t = Math.floor(t / 256); }
  crypto.getRandomValues(b.subarray(6));
  b[6] = (b[6] & 0x0f) | 0x70; b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};

const run = (dir: string) => {
  try { execFileSync(process.execPath, [SCRIPT, dir]); return true; }
  catch { return false; }
};

let dir: string;
let roots: { handle: string; publicKey: KeyObject; privateKey: KeyObject }[];
let newcomer: { handle: string; lid: string; uid: string; vision: string; pub: string };

const writeRec = (d: string, rec: Record<string, unknown>) =>
  writeFileSync(join(d, `${rec.handle}.json`), JSON.stringify(rec, null, 2));

// Build a fully valid ledger: a pinned 3-root genesis ring + one properly sponsored newcomer.
const buildValidLedger = (d: string) => {
  writeFileSync(join(d, '_GENESIS_RING.json'),
    JSON.stringify(Object.fromEntries(roots.map(r => [r.handle, pubB64(r.publicKey)]))));
  for (const r of roots) {
    writeRec(d, {
      name: r.handle, handle: r.handle, lid: uuidv7(), pubkey: pubB64(r.publicKey),
      vision: { id: 'GENESIS_VISION' }, initiatedAt: '2026-07-07', genesis: true, sponsors: [],
    });
  }
  const sponsors = roots.map(r => ({
    handle: r.handle,
    signature: edSign(null, msg(newcomer.handle, newcomer.pub, newcomer.lid, newcomer.uid, newcomer.vision), r.privateKey).toString('base64'),
  }));
  writeRec(d, {
    name: 'Newcomer', handle: newcomer.handle, lid: newcomer.lid, pubkey: newcomer.pub, uid: newcomer.uid,
    vision: { id: newcomer.vision }, initiatedAt: '2026-07-07', genesis: false, sponsors,
  });
};

beforeAll(() => {
  roots = ['root-a', 'root-b', 'root-c'].map(handle => ({ handle, ...generateKeyPairSync('ed25519') }));
  const kp = generateKeyPairSync('ed25519');
  newcomer = { handle: 'newcomer', lid: uuidv7(), uid: 'firebase-uid-1', vision: 'vision-1', pub: pubB64(kp.publicKey) };
});

describe('the initiation ledger verifier', () => {
  beforeAll(() => { dir = mkdtempSync(join(tmpdir(), 'initiations-')); buildValidLedger(dir); });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('accepts a valid ledger (pinned ring + 3 verifying sponsors)', () => {
    expect(run(dir)).toBe(true);
  });

  it('rejects a re-pointed uid — the app-account binding is inside the signature', () => {
    const d = mkdtempSync(join(tmpdir(), 'initiations-'));
    buildValidLedger(d);
    const rec = JSON.parse(JSON.stringify(require(join(d, 'newcomer.json'))));
    writeRec(d, { ...rec, uid: 'attacker-uid' });
    expect(run(d)).toBe(false);
    rmSync(d, { recursive: true, force: true });
  });

  it('rejects a re-pointed lid — the network identity is inside the signature', () => {
    const d = mkdtempSync(join(tmpdir(), 'initiations-'));
    buildValidLedger(d);
    const rec = require(join(d, 'newcomer.json'));
    writeRec(d, { ...rec, lid: uuidv7(1) });
    expect(run(d)).toBe(false);
    rmSync(d, { recursive: true, force: true });
  });

  it('rejects a tampered sponsor signature', () => {
    const d = mkdtempSync(join(tmpdir(), 'initiations-'));
    buildValidLedger(d);
    const rec = require(join(d, 'newcomer.json'));
    const sig = Buffer.from(rec.sponsors[0].signature, 'base64');
    sig[0] ^= 0xff;
    writeRec(d, { ...rec, sponsors: [{ ...rec.sponsors[0], signature: sig.toString('base64') }, rec.sponsors[1], rec.sponsors[2]] });
    expect(run(d)).toBe(false);
    rmSync(d, { recursive: true, force: true });
  });

  it('rejects self-declared genesis not pinned in the ring', () => {
    const d = mkdtempSync(join(tmpdir(), 'initiations-'));
    buildValidLedger(d);
    const mallory = generateKeyPairSync('ed25519');
    writeRec(d, {
      name: 'Mallory', handle: 'mallory', lid: uuidv7(2), pubkey: pubB64(mallory.publicKey),
      vision: { id: 'x' }, initiatedAt: '2026-07-07', genesis: true, sponsors: [],
    });
    expect(run(d)).toBe(false);
    rmSync(d, { recursive: true, force: true });
  });

  it('rejects fewer than three sponsors', () => {
    const d = mkdtempSync(join(tmpdir(), 'initiations-'));
    buildValidLedger(d);
    const rec = require(join(d, 'newcomer.json'));
    writeRec(d, { ...rec, sponsors: rec.sponsors.slice(0, 2) });
    expect(run(d)).toBe(false);
    rmSync(d, { recursive: true, force: true });
  });

  it('the real repo ledger verifies', () => {
    expect(run(join(__dirname, '..', 'initiations'))).toBe(true);
  });
});
