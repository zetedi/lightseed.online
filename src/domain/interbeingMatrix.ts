import type { Community } from './community';
import type { Link, LinkRel } from './link';

export const INTERBEING_RELATIONS = [
  'collaborates_with',
  'recognises',
  'shares_resources_with',
] as const satisfies readonly LinkRel[];

export type InterbeingRelation = (typeof INTERBEING_RELATIONS)[number];
export type InterbeingRelationState = 'none' | 'proposed' | 'received' | 'reciprocal';

// The domain owns typed references, never English. DOMAIN_KEYS + translations.ts hold the mirror.
export const interbeingRelationKey = (rel: InterbeingRelation) => `interbeing_${rel}` as const;
export const interbeingRelationDescKey = (rel: InterbeingRelation) => `interbeing_${rel}_desc` as const;

export const isInterbeingRelation = (rel: LinkRel): rel is InterbeingRelation =>
  (INTERBEING_RELATIONS as readonly LinkRel[]).includes(rel);

export const interbeingRelationState = (
  fromId: string,
  toId: string,
  rel: InterbeingRelation,
  links: readonly Pick<Link, 'from' | 'to' | 'rel'>[],
): InterbeingRelationState => {
  const proposed = links.some(link => link.from === fromId && link.to === toId && link.rel === rel);
  const received = links.some(link => link.from === toId && link.to === fromId && link.rel === rel);
  if (proposed && received) return 'reciprocal';
  if (proposed) return 'proposed';
  if (received) return 'received';
  return 'none';
};

export interface CommunityDomainAnchor {
  canonicalDomain: string;
  aliases: string[];
  verification: 'self_declared';
}

const normalizeAnchorDomain = (value: string): string => {
  const withoutScheme = value.trim().toLowerCase().replace(/^https?:\/\//, '');
  const authority = withoutScheme.split(/[/?#]/, 1)[0] || '';
  return authority.replace(/^www\./, '').replace(/:\d+$/, '');
};

// The existing domain is an external anchor, but not yet a proof of control. Naming that
// distinction lets the UI expose an honest scaffold without pretending DNS verification exists.
export const communityDomainAnchor = (
  community: Pick<Community, 'domain' | 'domainAliases'>,
): CommunityDomainAnchor => ({
  canonicalDomain: normalizeAnchorDomain(community.domain),
  aliases: (community.domainAliases || []).map(normalizeAnchorDomain).filter(Boolean),
  verification: 'self_declared',
});
