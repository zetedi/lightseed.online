// The backend's public statement of custody. This belongs to the database, not to a
// community preference: a community may decide whether to reflect the commons, but it
// cannot declare that it governs data merely by changing its own document.
//
// Persisted at config/dataAuthority and written only through trusted backend tooling.
// The nodeLid is portable; Firestore document ids are deliberately absent.
export interface DataAuthority {
  version: 1;
  nodeLid: string;
}

export type CrownRole = 'about' | 'host' | 'node' | 'hub';

type CrownCommunity = {
  lid?: string | null;
  domain?: string | null;
  reflectsPublic?: boolean | null;
};

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export const isLid = (value: unknown): value is string =>
  typeof value === 'string' && UUID_V7.test(value);

// Firestore is an untyped boundary. Refuse unknown versions and malformed names instead
// of letting an administrative typo crown a domain.
export const dataAuthorityOf = (value: unknown): DataAuthority | null => {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as { version?: unknown; nodeLid?: unknown };
  if (candidate.version !== 1 || !isLid(candidate.nodeLid)) return null;
  return { version: 1, nodeLid: candidate.nodeLid };
};

// The complete naming law:
//   no explicit backend authority                    -> About
//   community domain, governed by another node       -> The Host
//   governing node, locally scoped                   -> The Node
//   governing node, community reflecting the commons -> The Hub
//
// A domain is only an address. A matching, portable node LID is the backend's explicit
// attestation that the community shown at that address governs it.
export const deriveCrownRole = (
  community: CrownCommunity | null | undefined,
  authority: DataAuthority | null | undefined,
): CrownRole => {
  if (
    !community?.domain?.trim()
    || !isLid(community.lid)
    || authority?.version !== 1
    || !isLid(authority.nodeLid)
  ) return 'about';
  if (community.lid !== authority.nodeLid) return 'host';
  return community.reflectsPublic === true ? 'hub' : 'node';
};

export const crownName = (role: CrownRole): 'About' | 'The Host' | 'The Node' | 'The Hub' => {
  if (role === 'host') return 'The Host';
  if (role === 'node') return 'The Node';
  if (role === 'hub') return 'The Hub';
  return 'About';
};
