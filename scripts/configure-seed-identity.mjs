#!/usr/bin/env node
// The issuer's realm (domain/seedIdentity): the application origin, open or closed registration, and
// the issuer's own SMTP courier for verification and password-recovery mail — read from the
// environment (SEED_IDENTITY_SMTP_URL=smtps://user:pass@host:465, SEED_IDENTITY_SMTP_FROM=…), never
// from the command line where a password would land in the shell's history.
import { writeFile } from 'node:fs/promises';
import { seedIdentityRealm } from '../src/domain/seedIdentity.mjs';
const [origin, output, ...extra] = process.argv.slice(2);
const smtpOf = (url, from) => {
  if (!url && !from) return null;
  const parsed = new URL(url);
  if (!['smtps:', 'smtp:'].includes(parsed.protocol) || !from) throw new Error('smtp');
  const ssl = parsed.protocol === 'smtps:';
  return { host: parsed.hostname, port: parsed.port ? Number(parsed.port) : ssl ? 465 : 587, from, ssl,
    ...(parsed.username ? { user: decodeURIComponent(parsed.username), password: decodeURIComponent(parsed.password) } : {}) };
};
try {
  if (!origin || !output || (extra.length && (extra.length !== 1 || extra[0] !== '--open-registration'))) throw new Error('usage');
  const smtp = smtpOf(process.env.SEED_IDENTITY_SMTP_URL, process.env.SEED_IDENTITY_SMTP_FROM);
  const realm = seedIdentityRealm(origin, extra.length ? 'open' : 'closed', smtp);
  await writeFile(output, JSON.stringify(realm, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  console.log(smtp ? 'Realm prepared with its SMTP courier. Configure matching API enrollment policy before opening the identity service.'
    : 'Realm prepared. Set SEED_IDENTITY_SMTP_URL and SEED_IDENTITY_SMTP_FROM (or configure SMTP in the console) so verification and recovery mail can leave; configure matching API enrollment policy before opening the identity service.');
} catch {
  console.error('Provide an HTTPS application origin and a new output file: npm run seed:identity:configure -- https://app.example /private/lightseed-realm.json [--open-registration]  (SMTP: SEED_IDENTITY_SMTP_URL, SEED_IDENTITY_SMTP_FROM in the environment)');
  process.exitCode = 1;
}
