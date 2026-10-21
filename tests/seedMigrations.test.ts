import { describe, expect, it } from 'vitest';
import { seedMigrationSql } from '../src/domain/seedMigrations';

describe('migration source contract', () => {
  it('orders source deterministically without changing the input', async () => {
    const files = [{ name: '002_second.sql', sql: 'SELECT 2;' }, { name: '001_first.sql', sql: 'SELECT 1;' }];
    const original = structuredClone(files);
    expect(await seedMigrationSql(files)).toBe(await seedMigrationSql([...files].reverse()));
    expect(files).toEqual(original);
    expect(await seedMigrationSql(files)).not.toBe(await seedMigrationSql([{ ...files[0], sql: 'SELECT 3;' }, files[1]]));
  });
  it('refuses empty, ambiguous or non-SQL sources', async () => {
    await expect(seedMigrationSql([])).rejects.toThrow('empty');
    await expect(seedMigrationSql([{ name: "001_bad'.sql", sql: 'SELECT 1;' }])).rejects.toThrow('invalid_name');
    await expect(seedMigrationSql([{ name: '001_a.sql', sql: 'SELECT 1;' }, { name: '001_b.sql', sql: 'SELECT 2;' }])).rejects.toThrow('duplicate_version');
    await expect(seedMigrationSql([{ name: '001_a.sql', sql: '' }])).rejects.toThrow('sql_only');
    await expect(seedMigrationSql([{ name: '001_a.sql', sql: '\\! echo forbidden' }])).rejects.toThrow('sql_only');
  });
});
