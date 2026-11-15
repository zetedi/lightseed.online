// THE KEEPING (ring 2026-11-03): what a whole independent node is made of, named in one manifest so a
// backup can be held to itself before anything is restored — the database (the soil: records, chains,
// bindings, the clock, the queues), the media (the pictures by hash), the identity (the realm and its
// logins, the issuer's own database), and the configuration (the charter, the environment, the trust
// file, the secrets — the custodian's key stays outside by design). Every file is named with its size
// and its sha256; a restore refuses a backup that does not answer to its manifest. Pure: no file is read
// here; the hands (scripts/backup-seed.mjs, scripts/restore-seed.mjs) do that.
export const SEED_BACKUP_VERSION = 1;
export const SEED_BACKUP_PARTS = ['database', 'media', 'identity', 'config'];
const HEX64 = /^[a-f0-9]{64}$/;
// A file's name inside the backup: plain segments (a dotfile such as `.env` is one), never `.` or `..`, never empty.
const soundName = value => typeof value === 'string' && value.length > 0 && value.length <= 512
  && value.split('/').every(segment => /^[A-Za-z0-9._-]+$/.test(segment) && segment !== '.' && segment !== '..');
const NAME = { test: soundName };

/** @param {{takenAtMs: number, commit: string | null, migration: string | null, files: Array<{name: string, part: string, bytes: number, sha256: string}>}} p */
export function backupManifestOf({ takenAtMs, commit, migration, files }) {
  for (const file of files) {
    if (!NAME.test(file.name) || !SEED_BACKUP_PARTS.includes(file.part) || !Number.isInteger(file.bytes) || file.bytes < 0 || !HEX64.test(file.sha256)) {
      throw Object.assign(new Error('backup_file_unsound'), { code: 'backup_file_unsound', name: file.name });
    }
  }
  const names = new Set(files.map(f => f.name));
  if (names.size !== files.length) throw Object.assign(new Error('backup_file_twice'), { code: 'backup_file_twice' });
  return {
    version: SEED_BACKUP_VERSION, takenAt: new Date(takenAtMs).toISOString(), commit: commit ?? null, migration: migration ?? null,
    parts: SEED_BACKUP_PARTS.filter(part => files.some(f => f.part === part)),
    files: [...files].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)).map(f => ({ name: f.name, part: f.part, bytes: f.bytes, sha256: f.sha256 })),
  };
}

// The backup in the restoring hand, held to its manifest: every named file present, its size and its digest its own.
/** @param {*} manifest @param {(name: string) => {bytes: number, sha256: string} | null} present */
export function backupManifestIssues(manifest, present) {
  if (!manifest || typeof manifest !== 'object' || manifest.version !== SEED_BACKUP_VERSION || !Array.isArray(manifest.files)) return [{ code: 'manifest_unsound' }];
  const issues = [];
  for (const file of manifest.files) {
    if (!file || !NAME.test(String(file.name)) || !HEX64.test(String(file.sha256)) || !Number.isInteger(file.bytes)) { issues.push({ code: 'manifest_unsound', name: String(file?.name ?? '?') }); continue; }
    const found = present(file.name);
    if (!found) { issues.push({ code: 'file_missing', name: file.name }); continue; }
    if (found.bytes !== file.bytes) { issues.push({ code: 'file_size', name: file.name }); continue; }
    if (found.sha256 !== file.sha256) issues.push({ code: 'file_changed', name: file.name });
  }
  return issues;
}

// WHERE A CONFIGURATION FILE IS KEPT (2026-11-15). A file inside the installation's own directory keeps
// its path (`config/<path>`), so restore can place it back. A file the installation keeps OUTSIDE — a
// charter at /private/…, the trust file a Compose override mounts — is kept under a fixed label
// (`config/outside/<label>/<file>`): its name never comes from the raw path, so an absolute path can no
// longer break the manifest, and restore names it to the keeper instead of guessing where it belongs.
export const SEED_BACKUP_OUTSIDE = 'config/outside/';
/** @param {{inside: string | null, label: string, file: string}} p  inside = the path relative to seed/, or null when the file lives outside it */
export function backupConfigNameOf({ inside, label, file }) {
  const name = inside !== null ? `config/${inside.split(/[\\/]+/).filter(s => s && s !== '.').join('/')}` : `${SEED_BACKUP_OUTSIDE}${label}/${file}`;
  if (!soundName(name) || (inside !== null && name.startsWith(SEED_BACKUP_OUTSIDE))) throw Object.assign(new Error('backup_file_unsound'), { code: 'backup_file_unsound', name });
  return name;
}
// One variable out of a Compose .env text: the last plain KEY=value line wins, quotes laid off; null when absent or empty.
/** @param {string} text @param {string} key */
export function envValueOf(text, key) {
  let found = null;
  for (const line of String(text).split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m || m[1] !== key) continue;
    const quoted = /^(['"])(.*)\1$/.exec(m[2]);
    found = quoted ? quoted[2] : m[2].replace(/\s+#.*$/, '');
  }
  return found ? found : null;
}

// THE FUNCTION PRIVILEGES (2026-11-15). The soil is dumped --no-acl so it restores into a database whose
// roles are not the old ones; but PostgreSQL gives EXECUTE on every new function to PUBLIC, and the
// migrations withhold it one function at a time. Those withholdings are the only privileges a fresh
// restore would silently lose, so the backup writes them after the dump — the catalog's own answer:
export const SEED_BACKUP_PRIVILEGES_MARK = '-- lightseed: function privileges withheld from PUBLIC';
export const WITHHELD_ROUTINES_SQL = `SELECT format('REVOKE ALL ON ROUTINE %s FROM PUBLIC;', p.oid::regprocedure)
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname NOT IN ('pg_catalog', 'information_schema') AND n.nspname !~ '^pg_'
  AND p.proacl IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE')
  AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid = 'pg_proc'::regclass AND d.objid = p.oid AND d.deptype = 'e')
ORDER BY 1`;
/** @param {string} listing  the query's rows, one statement a line */
export function withheldRoutinesSectionOf(listing) {
  const lines = String(listing).split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  for (const line of lines) if (!/^REVOKE ALL ON ROUTINE [^;]+ FROM PUBLIC;$/.test(line)) throw Object.assign(new Error('backup_privileges_unsound'), { code: 'backup_privileges_unsound' });
  return { count: lines.length, sql: `\n${SEED_BACKUP_PRIVILEGES_MARK} (${lines.length})\n${lines.join('\n')}${lines.length ? '\n' : ''}` };
}
