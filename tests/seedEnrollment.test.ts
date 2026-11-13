import { describe, expect, it } from 'vitest';
import { enrollmentPlanOf, issuerAccountRepresentationOf, bindingsAfterEnrollment, namePartsOf } from '../src/domain/seedEnrollment';

// THE ENROLLMENT AT SCALE (ring 2026-11-14): one login per person at the issuer, planned for a whole
// census before the crossing — a standing account is bound, a missing one is made, a shared address
// or a binding that points elsewhere stops the person, the departed are not enrolled.

const identity = (uid: string, over: Record<string, unknown> = {}) => ({ sourceUid: uid, targetUid: uid, personLid: `019a0000-0000-7000-8000-${uid.padStart(12, '0')}`, ...over });
const people = { alice: { email: 'Alice@Example.test ', displayName: 'Alice Ada Lovelace' }, bob: { email: 'bob@example.test', displayName: 'Bob' }, carol: { displayName: 'Carol' }, dave: { email: 'not an address' }, erin: { email: 'bob@example.test', displayName: 'Erin' } };

describe('enrollmentPlanOf — one login per person', () => {
  it('binds a standing account, makes a missing one, leaves a bound one standing', () => {
    const plan = enrollmentPlanOf(
      [identity('alice'), identity('bob'), identity('frank', { departed: true })],
      people,
      [{ id: 'sub-alice', email: 'alice@example.test', username: 'alice' }],
      [],
    );
    expect(plan.ready).toBe(true);
    expect(plan.bind).toEqual([{ uid: 'alice', subject: 'sub-alice', email: 'alice@example.test' }]);
    expect(plan.make).toEqual([{ uid: 'bob', email: 'bob@example.test', username: 'bob@example.test', firstName: 'Bob', lastName: '' }]);
    expect(plan.standing).toEqual([]);
    expect(plan.skipped).toEqual(['frank']);
    const again = enrollmentPlanOf([identity('alice'), identity('bob')], people,
      [{ id: 'sub-alice', email: 'alice@example.test' }, { id: 'sub-bob', email: 'bob@example.test' }],
      [{ subject: 'sub-alice', uid: 'alice' }, { subject: 'sub-bob', uid: 'bob' }]);
    expect(again.ready).toBe(true); expect(again.make).toEqual([]); expect(again.bind).toEqual([]);
    expect(again.standing.map(b => b.uid)).toEqual(['alice', 'bob']);
  });

  it('a missing person, a missing or unsound address, and a shared address stop the person', () => {
    const plan = enrollmentPlanOf([identity('carol'), identity('dave'), identity('bob'), identity('erin'), identity('ghost')], people, [], []);
    expect(plan.ready).toBe(false);
    expect(plan.issues.map(i => [i.code, i.uid])).toEqual([
      ['email_missing', 'carol'], ['email_unsound', 'dave'], ['person_missing', 'ghost'], ['email_shared', 'bob'], ['email_shared', 'erin'],
    ]);
    expect(plan.make).toEqual([]);
  });

  it('a binding is never re-pointed: a subject bound elsewhere, a uid bound elsewhere', () => {
    const accounts = [{ id: 'sub-alice', email: 'alice@example.test' }];
    const elsewhere = enrollmentPlanOf([identity('alice')], people, accounts, [{ subject: 'sub-alice', uid: 'someone-else' }]);
    expect(elsewhere.issues).toEqual([expect.objectContaining({ code: 'subject_bound_elsewhere', uid: 'alice' })]);
    const otherSubject = enrollmentPlanOf([identity('alice')], people, accounts, [{ subject: 'sub-old', uid: 'alice' }]);
    expect(otherSubject.issues).toEqual([expect.objectContaining({ code: 'uid_bound_elsewhere', uid: 'alice' })]);
    const noAccount = enrollmentPlanOf([identity('bob')], people, [], [{ subject: 'sub-old', uid: 'bob' }]);
    expect(noAccount.issues).toEqual([expect.objectContaining({ code: 'uid_bound_elsewhere', uid: 'bob' })]);
    expect(noAccount.make).toEqual([]);
  });

  it('accepts the people as a Map and never reads the prototype', () => {
    const plan = enrollmentPlanOf([identity('constructor')], new Map([['constructor', { email: 'c@example.test' }]]), [], []);
    expect(plan.make.map(a => a.uid)).toEqual(['constructor']);
    const fromObject = enrollmentPlanOf([identity('constructor')], {}, [], []);
    expect(fromObject.issues).toEqual([expect.objectContaining({ code: 'person_missing' })]);
  });
});

describe('the account asked of the issuer, and the trust file after', () => {
  it('names split at the last word; a single word is the first name', () => {
    expect(namePartsOf('Alice Ada Lovelace')).toEqual({ firstName: 'Alice Ada', lastName: 'Lovelace' });
    expect(namePartsOf('  Bob ')).toEqual({ firstName: 'Bob', lastName: '' });
    expect(namePartsOf(undefined)).toEqual({ firstName: '', lastName: '' });
  });

  it('the representation is enabled, unverified, with a password to set — and carries no uid: the trust file binds', () => {
    expect(issuerAccountRepresentationOf({ uid: 'bob', email: 'bob@example.test', username: 'bob@example.test', firstName: 'Bob', lastName: '' })).toEqual({
      username: 'bob@example.test', email: 'bob@example.test', enabled: true, emailVerified: false, firstName: 'Bob', lastName: '',
      requiredActions: ['UPDATE_PASSWORD', 'VERIFY_EMAIL'],
    });
  });

  it('bindings after: the standing untouched, the new added once, ordered by uid', () => {
    const after = bindingsAfterEnrollment(
      [{ subject: 'sub-zed', uid: 'zed' }, { subject: 'sub-alice', uid: 'alice' }],
      [{ uid: 'bob', subject: 'sub-bob' }, { uid: 'alice', subject: 'sub-alice' }, { uid: 'bob', subject: 'sub-bob' }],
    );
    expect(after).toEqual([{ subject: 'sub-alice', uid: 'alice' }, { subject: 'sub-bob', uid: 'bob' }, { subject: 'sub-zed', uid: 'zed' }]);
  });
});
