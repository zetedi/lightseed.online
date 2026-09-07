import { describe, it, expect } from 'vitest';
import { PERSON_NAME_MAX, normalizePersonName, personNameProblem } from '../src/domain/personName';
import { DOMAIN_KEYS } from '../src/domain/words';

// A person's name (ring 2026-09-07): theirs to change; the law only keeps it a name.
describe('personNameProblem — a name that stands, and the three that do not', () => {
  it('stands: written, fits a line, no control characters', () => {
    expect(personNameProblem('Zoltán Etédi')).toBeNull();
    expect(personNameProblem('  The   Living  Web ')).toBeNull();
    expect(personNameProblem('نور')).toBeNull();
    expect(personNameProblem('a'.repeat(PERSON_NAME_MAX))).toBeNull();
  });
  it('refuses the empty, the over-long, the control-charactered — each by a domain key', () => {
    expect(personNameProblem('')).toBe('name_empty');
    expect(personNameProblem('   ')).toBe('name_empty');
    expect(personNameProblem(null)).toBe('name_empty');
    expect(personNameProblem('a'.repeat(PERSON_NAME_MAX + 1))).toBe('name_long');
    expect(personNameProblem('Zol' + String.fromCharCode(7) + 'tán')).toBe('name_chars');
    expect(personNameProblem('Zol' + String.fromCharCode(127) + 'tán')).toBe('name_chars');
    for (const k of ['name_empty', 'name_long', 'name_chars'] as const) expect(DOMAIN_KEYS).toContain(k);
  });
  it('normalizes whitespace to one breath', () => {
    expect(normalizePersonName('  The   Living' + String.fromCharCode(10) + ' Web ')).toBe('The Living Web');
    expect(normalizePersonName(undefined)).toBe('');
  });
});
