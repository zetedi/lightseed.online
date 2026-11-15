#!/usr/bin/env node
// seed:identity:enroll — THE ENROLLMENT AT SCALE (ring 2026-11-14): one login per person at the issuer, for a
// whole census, before the crossing.
//   npm run seed:identity:enroll -- <identities.json> --people <bundle.json> --trust <auth.json>
//                                  [--admin http://127.0.0.1:8082] [--realm lightseed] [--out <file>] [--apply] [--invite] [--invite-waiting]
// identities.json is what seed:export:origin wrote beside the bundle (the census of uids bound to a person);
// --people names the bundle itself, whose users/<uid> records carry the address and the name the origin knew;
// --trust names the installation's reviewed trust file (its issuer, its bindings). The issuer's administrator
// speaks from the environment — SEED_IDENTITY_ADMIN and SEED_IDENTITY_ADMIN_PASSWORD, as the identity stack's
// own .env names them — never from the command line. Without --apply this only PLANS (domain/seedEnrollment):
// which accounts the issuer must make, which standing accounts the trust file must bind, what stands in the
// way (a shared address, a binding that points elsewhere). With --apply and a clear plan, the accounts are made
// (enabled, address unverified, a password to set at first sign-in) and the trust file AFTER the ceremony is
// written to --out (<trust>.enrolled.json by default, owner-only, never overwriting) for the keeper to review,
// move into place and restart the API — the binding ceremony of migration 062 then binds every row at boot.
// With --invite the issuer is asked to mail each new account its set-password and verify-address link (the
// realm's own courier must be configured). With --invite-waiting (2026-11-15) the same mail goes to every
// person of this census who is bound — in this run or an earlier one — and whose account STILL WAITS for its
// first password: the hand for a run that stopped before its invitations, or for invitations the courier
// refused. It mails again whoever has not answered yet, so it is asked for by name, never implied.
// The administrator's token is short (60 s by default): the hand renews it as it goes.
// Exit 0 = clear (or applied), 2 = blocked, 1 = error.
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { enrollmentPlanOf, issuerAccountRepresentationOf, bindingsAfterEnrollment, normalizeEnrollmentEmail, issuerAccountWaits, adminTokenFresh } from '../seed/generated/chain.mjs';

const args = process.argv.slice(2);
const named = ['--people', '--trust', '--admin', '--realm', '--out'];
const flags = ['--apply', '--invite', '--invite-waiting'];
const option = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const positional = args.filter((a, i) => !a.startsWith('--') && !named.includes(args[i - 1]));
if (positional.length !== 1 || !option('--people') || !option('--trust') || args.some(a => a.startsWith('--') && !named.includes(a) && !flags.includes(a))) {
  console.error('Usage: npm run seed:identity:enroll -- <identities.json> --people <bundle.json> --trust <auth.json> [--admin http://127.0.0.1:8082] [--realm lightseed] [--out <file>] [--apply] [--invite] [--invite-waiting]');
  process.exit(1);
}
const apply = args.includes('--apply');
const invite = args.includes('--invite');
const inviteWaiting = args.includes('--invite-waiting');
const realm = option('--realm') ?? 'lightseed';
const admin = (option('--admin') ?? `http://127.0.0.1:${process.env.SEED_IDENTITY_PORT || 8082}`).replace(/\/$/, '');
const out = resolve(option('--out') ?? `${option('--trust')}.enrolled.json`);
const readJson = async path => JSON.parse(await readFile(resolve(path), 'utf8'));

// The issuer behind its edge: KC_HOSTNAME is the public origin, so a hand on the loopback port speaks with the
// forwarded headers the edge would set (the identity proof does the same) — the trust file's issuer names the host.
const issuerHost = issuer => { try { return new URL(issuer).host; } catch { return null; } };
const speak = (base, host) => (path, options = {}) => fetch(base + path, {
  ...options, redirect: 'manual', signal: AbortSignal.timeout(20000),
  headers: { 'x-forwarded-proto': 'https', 'x-forwarded-host': host, 'x-forwarded-port': '443', ...(options.headers ?? {}) },
});
const said = async response => { try { const body = await response.json(); return body?.errorMessage || body?.error_description || body?.error || ''; } catch { return ''; } };

try {
  const identities = await readJson(positional[0]);
  const bundle = await readJson(option('--people'));
  const trust = await readJson(option('--trust'));
  if (!Array.isArray(identities)) throw new Error('identities.json must be a JSON array.');
  if (!Array.isArray(bundle?.docs)) throw new Error('--people must name a bundle (a NodeBundle with docs).');
  if (!trust || typeof trust.issuer !== 'string' || !Array.isArray(trust.bindings)) throw new Error('--trust must name the authentication trust file (issuer, bindings).');
  const host = issuerHost(trust.issuer);
  if (!host) throw new Error('The trust file names no issuer URL.');
  const people = new Map();
  for (const doc of bundle.docs) {
    const m = /^users\/([^/]+)$/.exec(String(doc?.path ?? ''));
    if (m && doc.data && typeof doc.data === 'object') people.set(m[1], { email: doc.data.email, displayName: doc.data.displayName });
  }
  const user = process.env.SEED_IDENTITY_ADMIN, password = process.env.SEED_IDENTITY_ADMIN_PASSWORD;
  if (!user || !password) throw new Error('SEED_IDENTITY_ADMIN and SEED_IDENTITY_ADMIN_PASSWORD must name the issuer\'s administrator in the environment.');
  const ask = speak(admin, host);
  // The administrator's token, renewed before it runs out (domain/seedEnrollment adminTokenFresh).
  let token = null;
  const authorized = async () => {
    if (!token || !adminTokenFresh(token.issuedAtMs, token.expiresIn, Date.now())) {
      const issuedAtMs = Date.now();
      const tokenResponse = await ask('/realms/master/protocol/openid-connect/token', {
        method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: 'admin-cli', grant_type: 'password', username: user, password }),
      });
      if (tokenResponse.status !== 200) throw new Error(`The issuer refused the administrator (${tokenResponse.status}${(await said(tokenResponse)) ? ': ' + await said(tokenResponse) : ''}).`);
      const body = await tokenResponse.json();
      token = { issuedAtMs, expiresIn: body.expires_in, header: { authorization: 'Bearer ' + body.access_token } };
    }
    return token.header;
  };
  // Every account the realm holds, by pages — the census is matched by address.
  const accounts = [];
  for (let first = 0; ; first += 500) {
    const page = await ask(`/admin/realms/${encodeURIComponent(realm)}/users?briefRepresentation=true&first=${first}&max=500`, { headers: await authorized() });
    if (page.status !== 200) throw new Error(`The issuer would not list the realm's accounts (${page.status}).`);
    const rows = await page.json();
    for (const row of rows) accounts.push({ id: row.id, email: row.email ?? null, username: row.username ?? null });
    if (rows.length < 500) break;
  }
  const plan = enrollmentPlanOf(identities, people, accounts, trust.bindings);
  console.log(`Enrollment ${plan.ready ? 'has no planning conflicts' : 'is blocked'}: ${plan.make.length} accounts to make, ${plan.bind.length} standing accounts to bind, ${plan.standing.length} already bound, ${plan.skipped.length} departed (no login), ${plan.issues.length} issues; the realm holds ${accounts.length} accounts.`);
  for (const issue of plan.issues.slice(0, 40)) console.log(`  ${issue.code} ${issue.uid}: ${issue.detail}`);
  if (plan.issues.length > 40) console.log(`  … ${plan.issues.length - 40} more.`);
  const made = [];
  if (!plan.ready) { process.exitCode = 2; }
  else if (!apply) { if (plan.make.length || plan.bind.length) console.log('Nothing written: pass --apply to make the accounts and write the trust file after the ceremony.'); else console.log('Every person is enrolled and bound: nothing to do.'); }
  else if (!plan.make.length && !plan.bind.length) console.log('Every person is enrolled and bound: nothing to do.');
  else {
    const added = [...plan.bind.map(b => ({ uid: b.uid, subject: b.subject }))];
    for (const account of plan.make) {
      const response = await ask(`/admin/realms/${encodeURIComponent(realm)}/users`, {
        method: 'POST', headers: { ...(await authorized()), 'content-type': 'application/json' }, body: JSON.stringify(issuerAccountRepresentationOf(account)),
      });
      let id = null;
      if (response.status === 201) id = String(response.headers.get('location') || '').split('/').pop() || null;
      else if (response.status === 409) { // made by another hand meanwhile: a standing account is bound, never made twice
        const standing = await ask(`/admin/realms/${encodeURIComponent(realm)}/users?email=${encodeURIComponent(account.email)}&exact=true`, { headers: await authorized() });
        const rows = standing.status === 200 ? await standing.json() : [];
        id = rows.find(row => normalizeEnrollmentEmail(row.email) === account.email)?.id ?? null;
      }
      if (!id) throw new Error(`The issuer would not make the account for ${account.uid} (${response.status}${(await said(response)) ? ': ' + await said(response) : ''}); ${made.length} accounts were made before it and none of them was invited — rerun to continue (nothing is made twice)${invite ? ', with --invite-waiting so the accounts already made are mailed too' : ''}.`);
      made.push({ uid: account.uid, subject: id, email: account.email });
      added.push({ uid: account.uid, subject: id });
    }
    const after = { ...trust, bindings: bindingsAfterEnrollment(trust.bindings, added) };
    await writeFile(out, JSON.stringify(after, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    console.log(`Applied: ${made.length} accounts made, ${plan.bind.length} standing accounts bound; the trust file after the ceremony (${after.bindings.length} bindings) is ${out}.`);
    console.log('Next: review it, move it into the trust file\'s place and restart the API — the boot binds every row (migration 062); then the import.');
  }
  // THE INVITATIONS: the accounts this run made (--invite), and — only when asked by name — every person of the
  // census whose account stands and still waits for its first password (--invite-waiting): the issuer's own
  // record says who waits, so a run that stopped, or a courier that refused, is finished and never guessed.
  if (plan.ready && apply && (invite || inviteWaiting)) {
    const toInvite = invite ? [...made] : [];
    if (inviteWaiting) {
      const madeNow = new Set(made.map(account => account.subject));
      for (const account of [...plan.bind, ...plan.standing]) {
        if (madeNow.has(account.subject)) continue;
        const record = await ask(`/admin/realms/${encodeURIComponent(realm)}/users/${encodeURIComponent(account.subject)}`, { headers: await authorized() });
        if (record.status !== 200) throw new Error(`The issuer would not show the account of ${account.uid} (${record.status}).`);
        if (issuerAccountWaits(await record.json())) toInvite.push(account);
      }
    }
    let sent = 0; const failed = [];
    for (const account of toInvite) {
      const mail = await ask(`/admin/realms/${encodeURIComponent(realm)}/users/${encodeURIComponent(account.subject)}/execute-actions-email?lifespan=604800`, {
        method: 'PUT', headers: { ...(await authorized()), 'content-type': 'application/json' }, body: JSON.stringify(['UPDATE_PASSWORD', 'VERIFY_EMAIL']),
      });
      if (mail.status === 204) sent++; else failed.push(`${account.uid} (${mail.status}${(await said(mail)) ? ': ' + await said(mail) : ''})`);
    }
    console.log(`Invitations: ${sent} sent by the issuer's courier${failed.length ? `; ${failed.length} not sent — ${failed.join(', ')}` : ''}.`);
    if (failed.length) { console.log('Rerun with --apply --invite-waiting once the courier answers: it mails everyone of this census whose account still waits for its first password.'); process.exitCode = 1; }
  }
} catch (error) {
  console.error(error instanceof SyntaxError ? 'Invalid JSON input.' : error instanceof Error ? error.message : 'Enrollment failed.');
  process.exitCode = 1;
}
