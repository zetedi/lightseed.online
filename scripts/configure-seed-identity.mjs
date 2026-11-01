#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import { seedIdentityRealm } from '../src/domain/seedIdentity.mjs';
const [origin, output, ...extra] = process.argv.slice(2);
try {
  if (!origin || !output || (extra.length && (extra.length !== 1 || extra[0] !== '--open-registration'))) throw new Error('usage');
  const realm = seedIdentityRealm(origin, extra.length ? 'open' : 'closed');
  await writeFile(output, JSON.stringify(realm, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  console.log('Realm prepared. Configure SMTP and matching API enrollment policy before opening the identity service.');
} catch {
  console.error('Provide an HTTPS application origin and a new output file: npm run seed:identity:configure -- https://app.example /private/lightseed-realm.json [--open-registration]');
  process.exitCode = 1;
}
