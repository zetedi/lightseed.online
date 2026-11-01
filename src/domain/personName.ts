import type { DomainKey } from './words';
import { personNameProblem as problem, normalizePersonName as normalize } from './personName.mjs';
export { PERSON_NAME_MAX } from './personName.mjs';
export const personNameProblem = (raw: string | null | undefined): DomainKey | null => problem(raw);
export const normalizePersonName = (raw: string | null | undefined): string => normalize(raw);
