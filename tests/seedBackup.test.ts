import { describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, copyFile, writeFile, readFile, readdir, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

describe('database backup failure handling', () => {
  it('publishes only completed private dumps, without deleting earlier backups', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'lightseed-backup-'));
    try {
      const bin = join(directory, 'bin');
      const backups = join(directory, 'backups');
      await mkdir(bin);
      await mkdir(backups);
      await copyFile(resolve('seed/backup.sh'), join(directory, 'backup.sh'));
      await writeFile(join(bin, 'docker'), '#!/bin/sh\nprintf "database dump\\n"\nexit "${DUMP_STATUS:-0}"\n', { mode: 0o700 });
      await writeFile(join(backups, 'old.sql'), 'previous good backup');
      const run = (status: string) => spawnSync('bash', [join(directory, 'backup.sh')], {
        encoding: 'utf8', env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, DUMP_STATUS: status },
      });
      expect(run('1').status).not.toBe(0);
      expect(await readdir(backups)).toEqual(['old.sql']);
      expect(await readFile(join(backups, 'old.sql'), 'utf8')).toBe('previous good backup');
      const first = run('0');
      expect(first.status, first.stderr).toBe(0);
      expect(run('0').status).toBe(0);
      const names = (await readdir(backups)).filter(n => n !== 'old.sql');
      expect(names).toHaveLength(2);
      for (const name of names) {
        expect(name.endsWith('.sql')).toBe(true);
        expect(await readFile(join(backups, name), 'utf8')).toBe('database dump\n');
        expect((await stat(join(backups, name))).mode & 0o777).toBe(0o600);
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
