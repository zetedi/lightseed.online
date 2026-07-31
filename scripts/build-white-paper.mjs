#!/usr/bin/env node
// Print the preserved 2025 white paper: scripts/white-paper-2025.html → public/*.pdf.
// The PDF used to be a one-off print with no source in the repo; it has one now, so the
// paper can be re-typeset without archaeology. Headless Chrome does the typesetting (the
// same engine the first print used), the seal is injected from public/logo.svg, and the
// em dash guard refuses to print a paper that carries one back in.
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, 'white-paper-2025.html');
const SEAL = join(HERE, '..', 'public', 'logo.svg');
const OUT = join(HERE, '..', 'public', 'lifetree-network-white-paper-2025.pdf');

const CHROMES = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
].filter(Boolean);
const chrome = CHROMES.find(p => existsSync(p));
if (!chrome) throw new Error(`no Chrome found (tried: ${CHROMES.join(', ')}); set CHROME_PATH`);

const html = readFileSync(SRC, 'utf8');
// The release the root made on 2026-07-18, held by the build: this paper reads in a human hand.
if (html.includes('—')) throw new Error('em dash in scripts/white-paper-2025.html: the paper released it');

const seal = readFileSync(SEAL, 'utf8').replace(/<\?xml[^>]*\?>/, '').trim();
if (!html.includes('<!--SEAL-->')) throw new Error('no <!--SEAL--> placeholder in the source');

const work = mkdtempSync(join(tmpdir(), 'white-paper-'));
const page = join(work, 'paper.html');
writeFileSync(page, html.replace('<!--SEAL-->', seal));

execFileSync(chrome, [
    '--headless',
    '--disable-gpu',
    '--no-pdf-header-footer',
    `--print-to-pdf=${OUT}`,
    page,
], { stdio: ['ignore', 'ignore', 'pipe'] });
rmSync(work, { recursive: true, force: true });

const { size } = statSync(OUT);
console.log(`✓ printed ${(size / 1024).toFixed(0)} KB → public/lifetree-network-white-paper-2025.pdf`);
