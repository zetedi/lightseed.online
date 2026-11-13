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
