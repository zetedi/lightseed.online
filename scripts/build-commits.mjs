#!/usr/bin/env node
// Build the node's code chain: git log → public/commits.json. The repo's own history IS the
// network hub's growth chain — code changes are its growth, and every deploy carries its own
// history (Indra's net). Wired as `prebuild` after the initiates mirror, so the shipped bundle
// always embeds the commits that produced it. Deterministic output (newest first, no timestamp)
// for clean diffs.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', 'public', 'commits.json');
const LIMIT = 200;

// sha|author|ISO date|subject — %x7c is a literal '|' so the separator can't collide with
// format directives; subjects containing '|' are handled by capping the split.
const raw = execFileSync('git', ['log', `-${LIMIT}`, '--pretty=format:%H%x7c%an%x7c%aI%x7c%s'], {
  cwd: join(HERE, '..'),
  encoding: 'utf8',
});

const commits = raw
  .split('\n')
  .filter(Boolean)
  .map(line => {
    const [sha, author, iso, ...rest] = line.split('|');
    return { sha, author, at: new Date(iso).getTime(), title: rest.join('|') };
  })
  // git log already emits newest-first; sort defensively so the order is a guarantee, not a habit.
  .sort((a, b) => b.at - a.at || a.sha.localeCompare(b.sha));

writeFileSync(OUT, JSON.stringify({ version: 'lightseed.commits.v1', commits }, null, 2) + '\n');
console.log(`✓ chained ${commits.length} commit${commits.length === 1 ? '' : 's'} → public/commits.json`);
