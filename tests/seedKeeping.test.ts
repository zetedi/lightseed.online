// THE KEEPING (ring 2026-11-03): a backup's manifest names every file by size and digest, and a restore
// holds the backup to it before anything is written.
import { describe, expect, it } from 'vitest';
import { backupManifestOf, backupManifestIssues, SEED_BACKUP_PARTS } from '../src/domain/seedBackup.mjs';

const H = (n: number) => n.toString(16).padStart(64, '0');
const files = [
  { name: 'media.tar', part: 'media', bytes: 2048, sha256: H(2) },
  { name: 'database.sql', part: 'database', bytes: 1024, sha256: H(1) },
  { name: 'config/charter/node.json', part: 'config', bytes: 300, sha256: H(3) },
];

describe('the keeping', () => {
  it('names the parts and the files in order, and refuses an unsound or doubled file', () => {
    const manifest = backupManifestOf({ takenAtMs: Date.parse('2026-11-03T17:00:00Z'), commit: 'a'.repeat(40), migration: '062_bindings.sql', files });
    expect(manifest).toMatchObject({ version: 1, takenAt: '2026-11-03T17:00:00.000Z', commit: 'a'.repeat(40), migration: '062_bindings.sql', parts: ['database', 'media', 'config'] });
    expect(manifest.files.map(f => f.name)).toEqual(['config/charter/node.json', 'database.sql', 'media.tar']);
    expect(SEED_BACKUP_PARTS).toEqual(['database', 'media', 'identity', 'config']);
    expect(() => backupManifestOf({ takenAtMs: 0, commit: null, migration: null, files: [{ name: '../escape', part: 'config', bytes: 1, sha256: H(1) }] })).toThrow('backup_file_unsound');
    expect(() => backupManifestOf({ takenAtMs: 0, commit: null, migration: null, files: [{ name: 'config/./x', part: 'config', bytes: 1, sha256: H(1) }] })).toThrow('backup_file_unsound');
    expect(backupManifestOf({ takenAtMs: 0, commit: null, migration: null, files: [{ name: 'config/local/.env', part: 'config', bytes: 1, sha256: H(1) }] }).files[0].name).toBe('config/local/.env');
    expect(() => backupManifestOf({ takenAtMs: 0, commit: null, migration: null, files: [{ name: 'x', part: 'elsewhere', bytes: 1, sha256: H(1) }] })).toThrow('backup_file_unsound');
    expect(() => backupManifestOf({ takenAtMs: 0, commit: null, migration: null, files: [files[0], files[0]] })).toThrow('backup_file_twice');
  });
  it('holds a backup to its manifest: present, the right size, the right digest', () => {
    const manifest = backupManifestOf({ takenAtMs: 0, commit: null, migration: null, files });
    const whole = (name: string) => files.find(f => f.name === name) ?? null;
    expect(backupManifestIssues(manifest, whole)).toEqual([]);
    expect(backupManifestIssues(manifest, name => (name === 'media.tar' ? null : whole(name)))).toEqual([{ code: 'file_missing', name: 'media.tar' }]);
    expect(backupManifestIssues(manifest, name => (name === 'database.sql' ? { bytes: 1024, sha256: H(9) } : whole(name)))).toEqual([{ code: 'file_changed', name: 'database.sql' }]);
    expect(backupManifestIssues(manifest, name => (name === 'database.sql' ? { bytes: 1, sha256: H(1) } : whole(name)))).toEqual([{ code: 'file_size', name: 'database.sql' }]);
    expect(backupManifestIssues({ version: 2, files: [] }, whole)).toEqual([{ code: 'manifest_unsound' }]);
    expect(backupManifestIssues({ version: 1, files: [{ name: 'ok.sql', sha256: 'short', bytes: 1 }] }, whole)).toEqual([{ code: 'manifest_unsound', name: 'ok.sql' }]);
  });
});
