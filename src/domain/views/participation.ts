import type { Link } from '../link';

// Participation prism: the actors (uids) of an entity's incoming links, plus a membership
// test. Pure — works for any rel (vision 'joined', community 'member', a tree's roles…),
// no backend, no React. Another facet the same LIN refracts into.
export const participants = (links: Link[]): string[] =>
  Array.from(new Set(links.map(l => l.from).filter(Boolean)));

export const isParticipant = (links: Link[], uid?: string | null): boolean =>
  !!uid && links.some(l => l.from === uid);
