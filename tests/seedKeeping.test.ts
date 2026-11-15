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

// THE REVIEW'S MENDINGS (2026-11-15): a configuration file kept from outside the installation's directory, the
// one variable read out of seed/.env, and the function privileges written after a --no-acl dump.
describe('where a configuration file is kept', () => {
  it('a file inside seed/ keeps its own path', async () => {
    const { backupConfigNameOf } = await import('../src/domain/seedBackup.mjs');
    expect(backupConfigNameOf({ inside: '.env', label: 'env', file: '.env' })).toBe('config/.env');
    expect(backupConfigNameOf({ inside: 'identity/.env', label: 'env', file: '.env' })).toBe('config/identity/.env');
    expect(backupConfigNameOf({ inside: './charter/node.json', label: 'charter', file: 'node.json' })).toBe('config/charter/node.json');
  });
  it('a file outside seed/ is kept under its label, never under its raw path', async () => {
    const { backupConfigNameOf, backupManifestOf } = await import('../src/domain/seedBackup.mjs');
    const name = backupConfigNameOf({ inside: null, label: 'charter', file: 'node.json' });
    expect(name).toBe('config/outside/charter/node.json');
    expect(() => backupManifestOf({ takenAtMs: 0, commit: null, migration: null, files: [{ name, part: 'config', bytes: 1, sha256: 'a'.repeat(64) }] })).not.toThrow();
  });
  it('an unsound name stops the hand before anything is dumped', async () => {
    const { backupConfigNameOf } = await import('../src/domain/seedBackup.mjs');
    expect(() => backupConfigNameOf({ inside: '../charter/node.json', label: 'charter', file: 'node.json' })).toThrow('backup_file_unsound');
    expect(() => backupConfigNameOf({ inside: null, label: 'charter', file: 'my charter.json' })).toThrow('backup_file_unsound');
    expect(() => backupConfigNameOf({ inside: 'outside/charter/node.json', label: 'charter', file: 'node.json' })).toThrow('backup_file_unsound'); // the label's place is not a path's
  });
  it('reads one variable out of a Compose .env text', async () => {
    const { envValueOf } = await import('../src/domain/seedBackup.mjs');
    const text = '# the charter\nSEED_CHARTER_DIR=./charter\nOTHER=1\n  SEED_CHARTER_DIR = "/private/lightseed/charter"  \nexport QUOTED=\'a b\'\nBARE=value # a note\nEMPTY=\n';
    expect(envValueOf(text, 'SEED_CHARTER_DIR')).toBe('/private/lightseed/charter'); // the last line wins
    expect(envValueOf(text, 'QUOTED')).toBe('a b');
    expect(envValueOf(text, 'BARE')).toBe('value');
    expect(envValueOf(text, 'EMPTY')).toBeNull();
    expect(envValueOf(text, 'ABSENT')).toBeNull();
    expect(envValueOf(text, 'CHARTER_DIR')).toBeNull(); // a name is whole, never a suffix
  });
});
describe('the function privileges written after the dump', () => {
  it('writes the catalog\'s revokes under the mark, and counts them', async () => {
    const { withheldRoutinesSectionOf, SEED_BACKUP_PRIVILEGES_MARK } = await import('../src/domain/seedBackup.mjs');
    const section = withheldRoutinesSectionOf('REVOKE ALL ON ROUTINE seed.uid() FROM PUBLIC;\nREVOKE ALL ON ROUTINE seed.link_command(jsonb,text) FROM PUBLIC;\n');
    expect(section.count).toBe(2);
    expect(section.sql).toBe(`\n${SEED_BACKUP_PRIVILEGES_MARK} (2)\nREVOKE ALL ON ROUTINE seed.uid() FROM PUBLIC;\nREVOKE ALL ON ROUTINE seed.link_command(jsonb,text) FROM PUBLIC;\n`);
    expect(withheldRoutinesSectionOf('').count).toBe(0);
  });
  it('refuses anything that is not a revoke from PUBLIC', async () => {
    const { withheldRoutinesSectionOf } = await import('../src/domain/seedBackup.mjs');
    expect(() => withheldRoutinesSectionOf('GRANT ALL ON ROUTINE seed.uid() TO PUBLIC;')).toThrow('backup_privileges_unsound');
    expect(() => withheldRoutinesSectionOf('REVOKE ALL ON ROUTINE seed.uid() FROM PUBLIC; DROP SCHEMA seed;')).toThrow('backup_privileges_unsound');
    expect(() => withheldRoutinesSectionOf('psql: error: connection refused')).toThrow('backup_privileges_unsound');
  });
});
