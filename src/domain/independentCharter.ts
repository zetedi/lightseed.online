import { isLid } from './dataAuthority';
import type { IndependentCharter } from './charter';

export type IndependentCharterIssue =
  | 'shape' | 'version' | 'identity' | 'domain' | 'backend' | 'faces'
  | 'face_hosts' | 'keeper' | 'mail' | 'push' | 'theme' | 'repo';

const record = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);
const exact = (v: unknown, keys: string[]): v is Record<string, unknown> =>
  record(v) && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const text = (v: unknown): v is string => typeof v === 'string' && !!v.trim() && !/[\u0000-\u001f\u007f]/.test(v);
const email = (v: unknown): v is string => text(v) && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(v);
const host = (v: unknown): v is string => {
  if (typeof v !== 'string' || v.length > 253) return false;
  const labels = v.split('.');
  return labels.length > 1 && /[a-z]/.test(labels.at(-1)!)
    && labels.every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label));
};
const hosts = (v: unknown): v is string[] => Array.isArray(v) && v.every(host) && new Set(v).size === v.length;

// Parse untrusted JSON before deriving files or host routing. Reject extra fields rather
// than accidentally copying passwords or legacy Firebase settings into an artifact.
// Structural validity does not prove DNS ownership, service availability or deployment.
export function independentCharterProblem(value: unknown): IndependentCharterIssue | null {
  if (!exact(value, ['version', 'nodeLid', 'name', 'shortName', 'tagline', 'description', 'domain', 'aliases',
    'repo', 'keeper', 'mail', 'push', 'theme', 'backend', 'faces'])) return 'shape';
  const c = value;
  if (c.version !== 2) return 'version';
  if (!isLid(c.nodeLid) || ![c.name, c.shortName, c.tagline, c.description].every(text)) return 'identity';
  if (!host(c.domain) || !hosts(c.aliases) || c.aliases.includes(c.domain)) return 'domain';
  if (!exact(c.backend, ['kind']) || c.backend.kind !== 'postgres') return 'backend';
  if (!exact(c.keeper, ['email']) || !email(c.keeper.email)) return 'keeper';
  if (!exact(c.mail, ['from']) || !text(c.mail.from)) return 'mail';
  const from = c.mail.from.match(/^[^<>\r\n]*<([^<>]+)>$/)?.[1] ?? c.mail.from;
  if (!email(from)) return 'mail';
  if (!exact(c.push, ['subject', 'publicKey']) || !text(c.push.subject)
    || !(c.push.subject.startsWith('mailto:') ? email(c.push.subject.slice(7)) : httpsUrl(c.push.subject))
    || typeof c.push.publicKey !== 'string'
    || (c.push.publicKey !== '' && !/^[A-Za-z0-9_-]{87}$/.test(c.push.publicKey))) return 'push';
  if (!exact(c.theme, ['color', 'background']) || ![c.theme.color, c.theme.background].every(v => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v))) return 'theme';
  if (!httpsUrl(c.repo)) return 'repo';
  if (!Array.isArray(c.faces) || c.faces.length === 0) return 'faces';
  const ids = new Set<string>();
  const ownership = new Map<string, string>();
  let primary = false;
  for (const face of c.faces) {
    if (!exact(face, ['id', 'door', 'domains']) || typeof face.id !== 'string'
      || !/^[a-z][a-z0-9-]{1,30}$/.test(face.id) || ids.has(face.id)
      || !host(face.door) || !hosts(face.domains)) return 'faces';
    ids.add(face.id);
    primary ||= face.door === c.domain;
    for (const name of new Set([face.door, ...face.domains])) {
      if (ownership.has(name) && ownership.get(name) !== face.id) return 'face_hosts';
      if ([c.domain, ...c.aliases].includes(name) && face.door !== c.domain) return 'face_hosts';
      ownership.set(name, face.id);
    }
  }
  return primary ? null : 'face_hosts';
}

function httpsUrl(v: unknown): v is string {
  if (!text(v)) return false;
  try {
    const u = new URL(v);
    return u.protocol === 'https:' && host(u.hostname) && !u.username && !u.password && !u.hash;
  } catch { return false; }
}

export function isIndependentCharter(value: unknown): value is IndependentCharter {
  return independentCharterProblem(value) === null;
}
