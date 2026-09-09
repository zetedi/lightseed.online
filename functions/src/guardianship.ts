// GUARDIANS OF LIGHT, server side — the pure half. MIRRORS src/domain/guardianship.ts (the
// living-lifetree fact and the answer's outcome); tests/guardianship.test.ts holds them equal.
// index.ts (acceptTreeInvite) owns the plumbing: the yes mints the guardian link and, at the
// dial, the tree's validation.
export const GUARDIANS_TO_VALIDATE_DEFAULT = 1;

export const isLivingLifetree = (t: { treeType?: string | null; isNature?: boolean | null; diedAtMs?: number | null }): boolean =>
    !t.isNature && (!t.treeType || t.treeType === 'LIFETREE') && t.diedAtMs == null;

export type GuardianAnswer = 'accept' | 'decline';
export interface GuardianAnswerOutcome { mintsGuardianLink: boolean; requestMark: 'accepted' | 'declined'; validates: boolean }

export const guardianAnswerOutcome = (answer: GuardianAnswer, guardiansAfter: number, guardiansToValidate: number): GuardianAnswerOutcome => {
    const dial = Math.max(1, Math.floor(guardiansToValidate) || GUARDIANS_TO_VALIDATE_DEFAULT);
    if (answer === 'decline') return { mintsGuardianLink: false, requestMark: 'declined', validates: false };
    return { mintsGuardianLink: true, requestMark: 'accepted', validates: guardiansAfter >= dial };
};
