#!/usr/bin/env node
// seed:import — a sealed bundle arrives by additive merge (ring 2026-11-02).
//   npm run seed:import -- bundle.json --anchor anchor.json [--identities identities.json] [--report report.json] [--apply]
// Connects as the migration owner through the PG* environment. Without --apply this only PLANS:
// the proposal is printed (and written to --report, owner-only, never overwriting). With --apply and
// no planning conflict, every planned record lands in one transaction. identities.json is an array
// of { "sourceUid", "targetUid", "personLid" } the installation vouches for; a uid whose login the
// installation bound by reviewed configuration (an explicit binding in the auth trust file) may
// arrive before the person has spoken here. Exit 0 = clear (or applied), 2 = blocked, 1 = error.
import { readFile, writeFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ownerClient, cross, localUidCensus } from './bundle.mjs';

const args = process.argv.slice(2);
const option = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const named = ['--anchor', '--identities', '--report'];
const positional = args.filter((a, i) => !a.startsWith('--') && !named.includes(args[i - 1]));
if (positional.length !== 1 || !option('--anchor') || args.some(a => a.startsWith('--') && ![...named, '--apply'].includes(a))) {
  console.error('Usage: npm run seed:import -- bundle.json --anchor anchor.json [--identities identities.json] [--report report.json] [--apply]');
  process.exit(1);
}
const readJson = async path => {
  const absolute = resolve(path);
  if ((await stat(absolute)).size > 256 * 1024 * 1024) throw new Error('Input exceeds the 256 MiB limit.');
  return JSON.parse(await readFile(absolute, 'utf8'));
};
const client = ownerClient();
try {
  const incoming = await readJson(positional[0]);
  const anchor = await readJson(option('--anchor'));
  const identities = option('--identities') ? await readJson(option('--identities')) : [];
  if (!incoming?.head || !Array.isArray(incoming.docs) || typeof incoming.manifestHash !== 'string' || !incoming.seal) throw new Error('Expected a sealed NodeBundle.');
  if (!Array.isArray(identities) || identities.some(i => !i || ['sourceUid', 'targetUid', 'personLid'].some(k => typeof i[k] !== 'string' || !i[k]))) {
    throw new Error('Each identity binding needs sourceUid, targetUid and personLid.');
  }
  await client.connect();
  const { plan, applied, inserted, already } = await cross(client, { incoming, anchor, identities, apply: args.includes('--apply') });
  if (option('--report')) await writeFile(resolve(option('--report')), JSON.stringify(plan, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  const unbound = plan.issues.filter(i => i.code === 'identity_unbound').length;
  console.log(`Merge proposal ${plan.ready ? 'has no planning conflicts' : 'is blocked'}: ${plan.inserts.length} records to land, ${plan.unchanged.length} unchanged, ${plan.rebuild.length} witnesses, ${plan.issues.length} issues.`);
  for (const issue of plan.issues.slice(0, 40)) console.log(`  ${issue.code}${issue.path ? ' ' + issue.path : ''}: ${issue.detail}`);
  if (plan.issues.length > 40) console.log(`  … ${plan.issues.length - 40} more (see --report).`);
  if (unbound) console.log(`Identities needing a binding (${unbound}): ${localUidCensus(incoming.docs).join(', ')}`);
  if (already) console.log(`This bundle already crossed here on ${already.exportedAtMs ? new Date(already.exportedAtMs).toISOString() : 'an earlier day'}.`);
  if (applied) console.log(`Applied: ${inserted} records landed in one transaction.`);
  else if (plan.ready) console.log('Nothing written: pass --apply to land the proposal.');
  process.exitCode = plan.ready ? 0 : 2;
} catch (error) {
  console.error(error instanceof SyntaxError ? 'Invalid JSON input.' : error instanceof Error ? error.message : 'Import failed.');
  process.exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
}
