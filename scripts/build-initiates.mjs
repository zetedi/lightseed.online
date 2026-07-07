#!/usr/bin/env node
// Build the app mirror of the initiation ledger: initiations/*.json → public/initiates.json.
// Git is the source of truth; this file is what the app (and the Firestore sync) reads. The
// verifier runs first — an invalid ledger never mirrors. Wired as `prebuild`, so every deploy
// carries the current ledger. Deterministic output (sorted, no timestamp) for clean diffs.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIR = join(HERE, '..', 'initiations');
const OUT = join(HERE, '..', 'public', 'initiates.json');

// The three-sponsor rule gates the mirror too.
execFileSync(process.execPath, [join(HERE, 'verify-initiations.mjs')], { stdio: 'inherit' });

const files = readdirSync(DIR).filter(f => f.endsWith('.json') && f !== 'schema.json' && !f.startsWith('_'));
const initiates = files
  .map(f => JSON.parse(readFileSync(join(DIR, f), 'utf8')))
  .map(({ handle, name, lid, pubkey, uid, domain, genesis, initiatedAt }) => ({
    handle, name, lid, pubkey,
    ...(uid ? { uid } : {}),
    ...(domain ? { domain } : {}),
    ...(genesis ? { genesis: true } : {}),
    initiatedAt,
  }))
  .sort((a, b) => a.handle.localeCompare(b.handle));

writeFileSync(OUT, JSON.stringify({ version: 'lightseed.initiates.v1', initiates }, null, 2) + '\n');
console.log(`✓ mirrored ${initiates.length} initiate${initiates.length === 1 ? '' : 's'} → public/initiates.json`);
