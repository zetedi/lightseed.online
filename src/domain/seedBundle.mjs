// THE CROSSING'S MAP (ring 2026-11-02): where each travelling collection of the bundle law
// (domain/bundle TRAVEL_PLAN) lives in the seed's soil, and how a row becomes a bundle document
// and back. One closed map — table names never come from input; ids and documents ride as
// parameters. tests/seedBundle.test.ts holds it to the travel plan and to seed/schema: a
// collection that travels and has no row here, or a row here for a collection that must stay
// home, fails the gate. Witness collections (initiates) are read for comparison only.
export const SEED_BUNDLE_TABLES = Object.freeze({
  users: { table: 'users', kind: 'plain' },
  persons: { table: 'persons', kind: 'plain' },
  admins: { table: 'admins', kind: 'plain' },
  config: { table: 'config', kind: 'plain' },
  initiates: { table: 'initiates', kind: 'plain', witness: true },
  lifetrees: { table: 'lifetrees', kind: 'plain' },
  visions: { table: 'visions', kind: 'plain' },
  pulses: { table: 'pulses', kind: 'plain' },
  covenants: { table: 'covenants', kind: 'plain' },
  communities: { table: 'communities', kind: 'plain' },
  lightHouses: { table: 'light_houses', kind: 'plain' },
  alignments: { table: 'alignments', kind: 'plain' },
  rays: { table: 'rays', kind: 'plain' },
  glow: { table: 'glow', kind: 'plain' },
  gifts: { table: 'gifts', kind: 'plain' },
  spends: { table: 'spends', kind: 'plain' },
  stays: { table: 'stays', kind: 'plain' },
  supports: { table: 'supports', kind: 'plain' },
  networkInvites: { table: 'network_invites', kind: 'plain' },
  communityInvites: { table: 'community_invites', kind: 'plain' },
  communityTreeInvites: { table: 'community_tree_invites', kind: 'plain' },
  communityKeeperInvites: { table: 'community_keeper_invites', kind: 'plain' },
  treeKeepingInvites: { table: 'tree_keeping_invites', kind: 'plain' },
  inviteRequests: { table: 'invite_requests', kind: 'plain' },
  collabs: { table: 'collabs', kind: 'plain' },
  intelligences: { table: 'intelligences', kind: 'plain' },
  personas: { table: 'personas', kind: 'plain' },
  memories: { table: 'memories', kind: 'plain' },
  subscriptions: { table: 'subscriptions', kind: 'plain' },
  // The graph: real columns (the id law from__rel__to is the table's own); the document carries them as fields.
  links: { table: 'links', kind: 'graph' },
  secretLinks: { table: 'secret_links', kind: 'graph' },
  // Subcollections flatten to parent-prefixed tables.
  'persons/*/keys': { table: 'person_keys', kind: 'parents', parents: ['person_id'] },
  'persons/*/keyEvents': { table: 'person_key_events', kind: 'parents', parents: ['person_id'] },
  'persons/*/keyRecoveries': { table: 'person_key_recoveries', kind: 'parents', parents: ['person_id'] },
  'persons/*/keyRecoveries/*/witnesses': { table: 'person_key_recovery_witnesses', kind: 'parents', parents: ['person_id', 'recovery_id'] },
  'lifetrees/*/occupancy': { table: 'lifetree_occupancy', kind: 'parents', parents: ['lifetree_id'] },
  'pulses/*/signatures': { table: 'pulse_signatures', kind: 'parents', parents: ['pulse_id'] },
  'pulses/*/witnesses': { table: 'pulse_witnesses', kind: 'parents', parents: ['pulse_id'] },
  'covenants/*/signatures': { table: 'covenant_signatures', kind: 'parents', parents: ['covenant_id'] },
  // The five loves subcollections share one table; the parent kind is a column.
  'lifetrees/*/loves': { table: 'loves', kind: 'loves', parentKind: 'lifetrees' },
  'visions/*/loves': { table: 'loves', kind: 'loves', parentKind: 'visions' },
  'pulses/*/loves': { table: 'loves', kind: 'loves', parentKind: 'pulses' },
  'communities/*/loves': { table: 'loves', kind: 'loves', parentKind: 'communities' },
  'lightHouses/*/loves': { table: 'loves', kind: 'loves', parentKind: 'lightHouses' },
});

const LID = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;
// A path segment that can travel: non-empty, no slash, no control character, not a dot name.
export const portableSegment = value => typeof value === 'string' && value.length > 0 && value.length <= 512
  && !value.includes('/') && !/[\u0000-\u001f\u007f]/.test(value) && value !== '.' && value !== '..';
// 'lifetrees/abc/loves/u1' → 'lifetrees/*/loves' (the travel plan's signature).
export const bundleSignature = path => path.split('/').filter((_, i) => i % 2 === 0).join('/*/');

// The SELECT that reads a whole collection as portable rows (fixed text; nothing from input).
export function bundleReadSql(signature) {
  const law = SEED_BUNDLE_TABLES[signature];
  if (!law) return null;
  if (law.kind === 'plain') return `SELECT id, doc FROM public.${law.table} ORDER BY id`;
  if (law.kind === 'graph') return `SELECT id, from_id, rel, to_id, lid, doc, created_at FROM public.${law.table} ORDER BY id`;
  if (law.kind === 'loves') return `SELECT parent_id AS p1, uid AS id, doc FROM public.loves WHERE parent_kind='${law.parentKind}' ORDER BY parent_id, uid`;
  const parents = law.parents.map((column, i) => `${column} AS p${i + 1}`).join(', ');
  return `SELECT ${parents}, id, doc FROM public.${law.table} ORDER BY ${law.parents.join(', ')}, id`;
}

// A row read by bundleReadSql → the bundle document, or null when an id cannot travel as a path.
export function bundleDocOf(signature, row) {
  const law = SEED_BUNDLE_TABLES[signature];
  if (!law || !portableSegment(row.id)) return null;
  const heads = signature.split('/*/');
  if (law.kind === 'plain') return { path: `${heads[0]}/${row.id}`, data: row.doc };
  if (law.kind === 'graph') {
    if (!portableSegment(row.from_id) || !portableSegment(row.to_id) || !portableSegment(row.rel)) return null;
    const createdAt = row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at;
    return { path: `${heads[0]}/${row.id}`, data: { ...row.doc, from: row.from_id, rel: row.rel, to: row.to_id, lid: row.lid, createdAt } };
  }
  const parents = heads.length - 1;
  const segments = [];
  for (let i = 0; i < parents; i++) {
    const parent = row[`p${i + 1}`];
    if (!portableSegment(parent)) return null;
    segments.push(heads[i], parent);
  }
  segments.push(heads[parents], row.id);
  return { path: segments.join('/'), data: row.doc };
}

// A bundle document → the INSERT that lands it, or null when the path does not fit the law.
export function bundleInsertOf(doc) {
  if (!doc || typeof doc.path !== 'string' || !doc.data || typeof doc.data !== 'object' || Array.isArray(doc.data)) return null;
  const segments = doc.path.split('/');
  if (segments.length % 2 !== 0 || !segments.every(portableSegment)) return null;
  const signature = bundleSignature(doc.path);
  const law = SEED_BUNDLE_TABLES[signature];
  if (!law || law.witness) return null;
  const id = segments[segments.length - 1];
  if (law.kind === 'plain') return { text: `INSERT INTO public.${law.table}(id, doc) VALUES ($1, $2::jsonb)`, values: [id, JSON.stringify(doc.data)] };
  if (law.kind === 'graph') {
    const { from, rel, to, lid, createdAt, ...rest } = doc.data;
    // The id law is the table's own: a link whose fields do not spell its id cannot land.
    if (![from, rel, to].every(portableSegment) || `${from}__${rel}__${to}` !== id || !/^[a-z][a-z0-9_]{0,63}$/.test(rel)
      || typeof lid !== 'string' || !LID.test(lid) || typeof createdAt !== 'string' || !ISO.test(createdAt)) return null;
    return { text: `INSERT INTO public.${law.table}(from_id, rel, to_id, lid, doc, created_at) VALUES ($1, $2, $3, $4, $5::jsonb, $6::timestamptz)`,
      values: [from, rel, to, lid, JSON.stringify(rest), createdAt] };
  }
  if (law.kind === 'loves') return { text: `INSERT INTO public.loves(parent_kind, parent_id, uid, doc) VALUES ($1, $2, $3, $4::jsonb)`, values: [law.parentKind, segments[1], id, JSON.stringify(doc.data)] };
  const parents = segments.filter((_, i) => i % 2 === 1).slice(0, -1);
  const columns = [...law.parents, 'id', 'doc'];
  const marks = columns.map((_, i) => i === columns.length - 1 ? `$${i + 1}::jsonb` : `$${i + 1}`);
  return { text: `INSERT INTO public.${law.table}(${columns.join(', ')}) VALUES (${marks.join(', ')})`, values: [...parents, id, JSON.stringify(doc.data)] };
}
