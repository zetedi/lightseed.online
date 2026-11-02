import { createMediaStore } from './media.mjs';
import { seedNodeDomain } from '../../src/domain/seedCommunity.mjs';
import { readFile } from 'node:fs/promises';
import { createAuthenticator } from './auth.mjs';
import { createDatabase } from './database.mjs';
import { createApi } from './server.mjs';
import { createMailOrgan, smtpTransportOptions } from './mail.mjs';
import { createAiOrgan, createCredentialCipher } from './ai.mjs';
import { createAiRails } from './aiRails.mjs';
import nodemailer from 'nodemailer';
import webpush from 'web-push';

const required = ['PGHOST', 'PGDATABASE', 'PGUSER', 'PGPASSWORD'];
if (required.some(key => !process.env[key])) {
  console.error('Set explicit database connection settings and restricted runtime credentials.');
  process.exit(1);
}
const port = Number(process.env.SEED_API_PORT ?? 8081);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('Invalid API port.'); process.exit(1);
}
const database = createDatabase();
let authenticate;
if (process.env.SEED_AUTH_CONFIG) {
  try {
    const source = await readFile(process.env.SEED_AUTH_CONFIG);
    if (source.length > 2 * 1024 * 1024) throw new Error('auth_config_too_large');
    authenticate = await createAuthenticator(JSON.parse(source.toString('utf8')), database.resolveIdentity, database.recordEmail);
  } catch { console.error('Invalid authentication configuration.'); process.exit(1); }
}
const nodeDomain = seedNodeDomain(process.env.SEED_NODE_ORIGIN);
if (process.env.SEED_NODE_ORIGIN && !nodeDomain) {
  console.error('Invalid HTTPS node origin.'); process.exit(1);
}
try { await database.ready(); } catch {
  console.error('Database is unavailable or the account is unsafe for serving requests.');
  await database.close(); process.exit(1);
}
let media;
if(process.env.SEED_MEDIA_DIR) {
  try {media=await createMediaStore(process.env.SEED_MEDIA_DIR);}
  catch {console.error('Media directory is unavailable.');await database.close();process.exit(1);}
}
// The face doors of this node (SEED_FACE_DOORS, comma-separated hostnames): a keeper's claim on one
// waits for the steward's grant instead of a DNS proof no keeper could give.
const faceDoors = (process.env.SEED_FACE_DOORS ?? '').split(',').map(h => h.trim().toLowerCase()).filter(Boolean);
if (faceDoors.some(h => h.length > 253 || !/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/.test(h))) {
  console.error('Invalid face door hostname.'); await database.close(); process.exit(1);
}
// THE MAIL ORGAN (ring 2026-11-03): grown when the installation names its charter (SEED_CHARTER); the
// SMTP courier (SEED_SMTP_URL, in runtime.env) and the push courier (SEED_VAPID_PRIVATE_KEY beside the
// charter's public key) each join when configured. Without the charter every letter refuses by name.
let mail = null, courier = null;
let charterSource = null;
if (process.env.SEED_CHARTER) {
  try { charterSource = (await readFile(process.env.SEED_CHARTER)).toString('utf8'); }
  catch (error) {
    // An absent charter grows no mail organ (the Compose default mounts an empty directory); anything else is a fault.
    if (error?.code !== 'ENOENT' && error?.code !== 'EISDIR') { console.error('The charter could not be read.'); await database.close(); process.exit(1); }
    console.warn('No charter at SEED_CHARTER: the mail organ is not grown; every letter refuses by name (mail_unavailable).');
  }
}
if (charterSource !== null) {
  try {
    const charter = JSON.parse(charterSource);
    const transport = process.env.SEED_SMTP_URL ? nodemailer.createTransport(smtpTransportOptions(process.env.SEED_SMTP_URL)) : null;
    const privateKey = process.env.SEED_VAPID_PRIVATE_KEY ?? '';
    const push = privateKey && charter.push?.publicKey ? { send: (subscription, notice) => webpush.sendNotification(subscription, JSON.stringify(notice),
      { TTL: 3600, vapidDetails: { subject: charter.push.subject, publicKey: charter.push.publicKey, privateKey } }) } : null;
    mail = createMailOrgan({ charter, nodeOrigin: process.env.SEED_NODE_ORIGIN || null, postal: process.env.SEED_MAIL_POSTAL || null, transport, push });
    courier = mail.createCourier(database.withSession);
  } catch (error) { console.error(error instanceof Error && error.code ? error.message : 'Invalid charter or mail configuration.'); await database.close(); process.exit(1); }
}
// THE AI ORGAN (ring 2026-11-03): grown when the installation holds a node key (SEED_ANTHROPIC_API_KEY,
// SEED_GEMINI_API_KEY) or can keep hands' keys (SEED_CREDENTIAL_KEY) — all three in runtime.env. Without
// any, every model call refuses by name (ai_unavailable); a malformed credential key is a fault.
let ai = null;
{
  const nodeKeys = { anthropic: process.env.SEED_ANTHROPIC_API_KEY || null, google: process.env.SEED_GEMINI_API_KEY || null };
  let cipher = null;
  if (process.env.SEED_CREDENTIAL_KEY) {
    try { cipher = createCredentialCipher(process.env.SEED_CREDENTIAL_KEY); }
    catch (error) { console.error(error instanceof Error ? error.message : 'Invalid credential key.'); await database.close(); process.exit(1); }
  }
  if (cipher || nodeKeys.anthropic || nodeKeys.google) ai = createAiOrgan({ rails: createAiRails(), cipher, nodeKeys });
  else console.warn('No SEED_ANTHROPIC_API_KEY, SEED_GEMINI_API_KEY or SEED_CREDENTIAL_KEY: the AI organ is not grown; every model call refuses by name (ai_unavailable).');
}
const server = createApi(database, authenticate, { nodeDomain, media, faceDoors, mail, ai });
courier?.start(Number(process.env.SEED_COURIER_INTERVAL_MS) || 15000);
server.on('error', async () => {
  console.error('API listener failed.'); await database.close(); process.exitCode = 1;
});
server.listen(port, process.env.SEED_API_HOST ?? '127.0.0.1', () => console.log('Independent graph API listening.'));
let stopping = false;
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  if (stopping) return;
  stopping = true;
  const timeout = setTimeout(() => process.exit(1), 20000);
  timeout.unref();
  courier?.stop();
  server.close(async () => { await database.close(); clearTimeout(timeout); });
});
