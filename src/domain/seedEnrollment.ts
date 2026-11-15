// THE ENROLLMENT AT SCALE (ring 2026-11-14): one login per person at the issuer, before the crossing.
// The binding ceremony (migration 062) lands a person on the second node once the installation's trust
// file binds their login — but the logins themselves were "one per person at the issuer, by the realm's
// own means": a hand at the console for every member. This law plans that hand for a whole census:
// the identities the exporter wrote (`<bundle>.identities.json`), the people the bundle carries
// (`users/<uid>`: the address and the name the origin knew), the accounts the issuer already holds,
// and the bindings the trust file already names — and says, per person, what the issuer must be asked
// to make, which binding must be written, and what stands in the way. Pure: the HTTP is the script's.
//
// The rules: a person is enrolled by their ADDRESS (the issuer keeps one account per address; a
// shared address is a conflict for both — one login per person, never one per two); a standing
// account is bound, never made twice; a subject the trust file already binds to ANOTHER uid is a
// conflict (a name is never re-pointed by a hand that did not review it — 062's law); a uid the file
// already binds to another subject is a conflict too (one login per person); the departed are not
// enrolled (no person, no login — they cross as names). Nothing here decides an identity: the
// account's id becomes the subject, the trust file the installation reviews becomes the proof.
export interface EnrollmentIdentity { sourceUid: string; targetUid: string; personLid?: string; departed?: boolean }
export interface EnrollmentPerson { email?: unknown; displayName?: unknown }
export interface IssuerAccount { id: string; email?: string | null; username?: string | null }
export interface TrustBinding { subject: string; uid: string }
export interface AccountToMake { uid: string; email: string; username: string; firstName: string; lastName: string }
export interface BindingToWrite { uid: string; subject: string; email: string }
export type EnrollmentIssueCode = 'person_missing' | 'email_missing' | 'email_unsound' | 'email_shared' | 'subject_bound_elsewhere' | 'uid_bound_elsewhere';
export interface EnrollmentIssue { code: EnrollmentIssueCode; uid: string; detail: string }
export interface EnrollmentPlan {
  make: AccountToMake[];        // no account at the issuer yet: ask it to make one (the binding follows its id)
  bind: BindingToWrite[];       // an account stands, the trust file does not name it yet
  standing: BindingToWrite[];   // account and binding both stand: nothing to do
  skipped: string[];            // the departed: no login is made for a name
  issues: EnrollmentIssue[];
  ready: boolean;               // no issue stands in the way of the whole census
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const normalizeEnrollmentEmail = (value: unknown): string => (typeof value === 'string' ? value.trim().toLowerCase() : '');
// The issuer's first and last name from the one name the origin knew: the last word is the family name.
export const namePartsOf = (displayName: unknown): { firstName: string; lastName: string } => {
  const words = (typeof displayName === 'string' ? displayName : '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return { firstName: '', lastName: '' };
  if (words.length === 1) return { firstName: words[0], lastName: '' };
  return { firstName: words.slice(0, -1).join(' '), lastName: words[words.length - 1] };
};

export const enrollmentPlanOf = (
  identities: readonly EnrollmentIdentity[],
  people: ReadonlyMap<string, EnrollmentPerson> | Record<string, EnrollmentPerson>,
  accounts: readonly IssuerAccount[],
  bindings: readonly TrustBinding[],
): EnrollmentPlan => {
  const personOf = (uid: string): EnrollmentPerson | undefined =>
    people instanceof Map ? people.get(uid) : Object.prototype.hasOwnProperty.call(people, uid) ? (people as Record<string, EnrollmentPerson>)[uid] : undefined;
  const accountByEmail = new Map<string, IssuerAccount>();
  for (const account of accounts) { const email = normalizeEnrollmentEmail(account.email); if (email && !accountByEmail.has(email)) accountByEmail.set(email, account); }
  const uidOfSubject = new Map(bindings.map(b => [b.subject, b.uid]));
  const subjectOfUid = new Map(bindings.map(b => [b.uid, b.subject]));
  const plan: EnrollmentPlan = { make: [], bind: [], standing: [], skipped: [], issues: [], ready: true };
  const issue = (code: EnrollmentIssueCode, uid: string, detail: string) => { plan.issues.push({ code, uid, detail }); plan.ready = false; };

  // The address of every person first, so a shared address is seen as a whole before anyone is enrolled.
  const emailOf = new Map<string, string>();
  const uidsOfEmail = new Map<string, string[]>();
  for (const identity of identities) {
    if (identity.departed) { plan.skipped.push(identity.targetUid); continue; }
    const person = personOf(identity.sourceUid);
    if (!person) { issue('person_missing', identity.targetUid, `the bundle carries no users/${identity.sourceUid} record`); continue; }
    const email = normalizeEnrollmentEmail(person.email);
    if (!email) { issue('email_missing', identity.targetUid, 'the person has no address at the origin'); continue; }
    if (!EMAIL_RE.test(email)) { issue('email_unsound', identity.targetUid, 'the address is not an address'); continue; }
    emailOf.set(identity.targetUid, email);
    uidsOfEmail.set(email, [...(uidsOfEmail.get(email) ?? []), identity.targetUid]);
  }
  for (const identity of identities) {
    const uid = identity.targetUid;
    const email = emailOf.get(uid);
    if (!email) continue;
    const sharing = uidsOfEmail.get(email) ?? [];
    if (sharing.length > 1) { issue('email_shared', uid, `${email} is the address of ${sharing.length} persons (${sharing.join(', ')}): one login per person`); continue; }
    const account = accountByEmail.get(email);
    const boundSubject = subjectOfUid.get(uid);
    if (!account) {
      if (boundSubject) { issue('uid_bound_elsewhere', uid, `the trust file binds this person to subject ${boundSubject}, but the issuer holds no account at ${email}`); continue; }
      const { firstName, lastName } = namePartsOf(personOf(identity.sourceUid)?.displayName);
      plan.make.push({ uid, email, username: email, firstName, lastName });
      continue;
    }
    const uidOfThisSubject = uidOfSubject.get(account.id);
    if (uidOfThisSubject && uidOfThisSubject !== uid) { issue('subject_bound_elsewhere', uid, `the account at ${email} is bound to ${uidOfThisSubject}; a binding is never re-pointed`); continue; }
    if (boundSubject && boundSubject !== account.id) { issue('uid_bound_elsewhere', uid, `the trust file binds this person to subject ${boundSubject}, not to the account at ${email}`); continue; }
    (uidOfThisSubject === uid ? plan.standing : plan.bind).push({ uid, subject: account.id, email });
  }
  return plan;
};

// The account the issuer is asked to make (Keycloak's user representation): enabled, the address
// unverified until the person proves it, a password to set at first sign-in — the issuer's own mail
// carries both when the hand asks it to. The uid does NOT ride into the issuer (its user profile drops
// unmanaged attributes, and the issuer authenticates a login, never an identity): the trust file the
// installation reviews is the one binding.
export const issuerAccountRepresentationOf = (account: AccountToMake): Record<string, unknown> => ({
  username: account.username, email: account.email, enabled: true, emailVerified: false,
  firstName: account.firstName, lastName: account.lastName,
  requiredActions: ['UPDATE_PASSWORD', 'VERIFY_EMAIL'],
});

// The trust file's bindings after the ceremony: the standing ones untouched, the new ones added once,
// ordered by uid so two hands writing the same census write the same file.
export const bindingsAfterEnrollment = (bindings: readonly TrustBinding[], added: readonly { uid: string; subject: string }[]): TrustBinding[] => {
  const bySubject = new Map(bindings.map(b => [b.subject, { subject: b.subject, uid: b.uid }]));
  for (const b of added) if (!bySubject.has(b.subject)) bySubject.set(b.subject, { subject: b.subject, uid: b.uid });
  return [...bySubject.values()].sort((a, b) => a.uid.localeCompare(b.uid) || a.subject.localeCompare(b.subject));
};

// WHO STILL WAITS FOR THEIR FIRST PASSWORD (2026-11-15). An account this ceremony made carries the
// required action UPDATE_PASSWORD until the person sets one; a run that stopped before its
// invitations, or an invitation the courier refused, leaves accounts that are bound and were never
// written to. The issuer's own record answers who they are — the hand keeps no list of its own.
export const issuerAccountWaits = (account: { requiredActions?: unknown; enabled?: unknown } | null | undefined): boolean =>
  !!account && account.enabled !== false && Array.isArray(account.requiredActions) && account.requiredActions.includes('UPDATE_PASSWORD');

// THE ADMINISTRATOR'S TOKEN IS SHORT (Keycloak's master realm: 60 seconds by default). A census takes
// longer, so the hand asks for a new one once half the life the issuer named has passed (never later
// than 30 seconds; an unnamed life is taken as the default).
export const adminTokenFresh = (issuedAtMs: number, expiresInSeconds: unknown, nowMs: number): boolean => {
  const life = typeof expiresInSeconds === 'number' && Number.isFinite(expiresInSeconds) && expiresInSeconds > 0 ? expiresInSeconds : 60;
  return nowMs - issuedAtMs < Math.min(life / 2, 30) * 1000;
};
