// THE HEAD OF A CROSSING (ring 2026-11-03): which charter may sign a bundle's head. A node leaves by
// its travel plan whatever soil it grew in — the version-2 independent charter of a PostgreSQL node,
// or the version-1 charter the origin was born with and still wears over Firestore. The head carries
// only the nodeLid and the domain, so each charter answers for its own soundness and nothing of the
// other's shape; a value that is neither is no charter at all.
import { charterProblem, type Charter } from './charter';
import { independentCharterProblem, type IndependentCharterIssue } from './independentCharter';
import type { DomainKey } from './words';

export type CrossingCharterIssue = IndependentCharterIssue | DomainKey;

export function crossingCharterProblem(value: unknown): CrossingCharterIssue | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'shape';
  if ((value as { version?: unknown }).version !== 1) return independentCharterProblem(value);
  try { return charterProblem(value as Charter); } catch { return 'shape'; }
}
