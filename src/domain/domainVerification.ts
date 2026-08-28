import type { Community } from './community';
import { normalizeAnchorDomain } from './interbeingMatrix';

// DOMAIN VERIFICATION — proof that a community controls its external anchor, and nothing
// more. The proof is a DNS-01-style control challenge (RFC 8555 §8.4) in an underscored
// namespace (RFC 8552): a single-use random token the server minted, placed by the
// community's hand as a TXT record, then OBSERVED by the server. DNS verifies only
// "this community controls this external anchor" — never reputation, never ownership
// of the community, and the Interbeing Matrix stays independent of it.
//
// Plain contract: guaranteed now — the token is server-minted (>=128 bits), bound to the
// exact normalized domain and community, single-use, expiring; the verified mark is written
// ONLY by the server (rules refuse the field to every client hand) and speaks only while
// the community's canonical domain still equals the domain that was proven — changing the
// domain silently un-badges. Not guaranteed — re-observation on a schedule (reverification
// is by hand), aliases (only the canonical domain is proven), and the lasting `_lightseed`
// declaration record (optional, unread). Enforced by: functions/{startDomainVerification,
// checkDomainVerification}, firestore.rules communities update clause, and these laws' tests.

export const DOMAIN_CHALLENGE_LABEL = '_lightseed-challenge';
export const DOMAIN_CHALLENGE_PREFIX = 'lightseed-verification=v1:';
// A week to reach the DNS dashboard and let the record propagate; then a fresh start.
export const DOMAIN_CHALLENGE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Where the TXT record lives: _lightseed-challenge.<canonical domain>.
export const challengeRecordName = (domain: string): string =>
  `${DOMAIN_CHALLENGE_LABEL}.${normalizeAnchorDomain(domain)}`;

// What the TXT record says: lightseed-verification=v1:<token>.
export const challengeRecordValue = (token: string): string =>
  `${DOMAIN_CHALLENGE_PREFIX}${token}`;

// A resolver hands back each TXT answer as chunks (long records split at 255 bytes);
// the record proves the challenge only when its joined chunks equal the exact value.
export const txtProvesChallenge = (txtRecords: readonly (readonly string[])[], token: string): boolean =>
  txtRecords.some(chunks => chunks.join('') === challengeRecordValue(token));

// A challenge still answerable: unused and within its week.
export const challengeIsLive = (
  challenge: { usedAtMs: number | null; createdAtMs: number },
  nowMs: number,
): boolean =>
  challenge.usedAtMs === null && nowMs - challenge.createdAtMs < DOMAIN_CHALLENGE_TTL_MS;

// The server-written mark on the community doc. Client rules refuse this field entirely.
export interface DomainVerification {
  domain: string;        // the normalized domain that was proven, frozen at observation
  method: 'dns_txt';
}

// The badge speaks only while the canonical domain still equals the proven one — a moved
// community returns to self-declared without anyone having to remember to clear the mark.
export const isDomainVerified = (
  community: Pick<Community, 'domain'> & { domainVerification?: { domain?: string } | null },
): boolean =>
  !!community.domainVerification?.domain &&
  normalizeAnchorDomain(community.domain) === community.domainVerification.domain;
