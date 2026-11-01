// THE DOCUMENT DOOR (ring 2026-11-02) — the generic, law-governed reading and writing of the
// node's documents, collection by collection. firestore.rules is the law the Firebase node keeps
// at the database boundary; the independent node keeps the SAME law in SQL (seed/schema/050–052):
// one rule function per collection, called by the row-level policies for every read and by
// seed.doc_write for every write. This file names what the door SERVES — the collections, their
// tables, the fields a query may filter on — and refuses malformed asks before they reach the
// database. It carries no authority: a filter never widens what the reader may see.
const identifier = (value, max = 512) => typeof value === 'string' && value.length > 0 && value.length <= max && !/[\u0000-\u001f\u007f]/.test(value);
const fieldName = value => typeof value === 'string' && /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(value);

// name → { parent: the subcollection's parent (a column), filters: equality / `in` fields,
// arrays: `has` (array-contains) fields }. The table each name maps to is SQL's (seed.doc_table)
// so one place owns the soil; tests/seedDocs.test.ts holds the two lists in step.
export const SEED_DOC_COLLECTIONS = Object.freeze({
  users: { filters: [] },
  persons: { filters: ['anonymous'] },
  admins: { filters: [] },
  config: { filters: [] },
  initiates: { filters: [] },
  lifetrees: { filters: ['anchorUid', 'domain', 'treeType', 'visibility', 'lightHouseId', 'validated'] },
  visions: { filters: ['authorId', 'domain', 'lifetreeId', 'communityId', 'visibility'] },
  pulses: { filters: ['authorId', 'lifetreeId', 'treeId', 'visionId', 'communityId', 'type', 'visibility', 'domain', 'threadId', 'reachTreeId',
    'chatTreeId', 'recipientUid', 'hash', 'lightHouseId', 'care', 'offeredToKind', 'offeredToId', 'isMatch', 'careAlert', 'offeringId', 'stayId', 'matchId'],
  arrays: ['participantUids'] },
  light_houses: { filters: ['anchorUid', 'domain', 'communityId', 'visibility'] },
  communities: { filters: ['anchorUid', 'domain', 'formation', 'rootLifetreeId'], arrays: ['domainAliases'] },
  alignments: { filters: ['initiatorUid', 'targetUid', 'initiatorTreeId', 'targetTreeId', 'status'] },
  covenants: { filters: ['proposedBy', 'alignmentId', 'status'] },
  covenant_signatures: { parent: true, filters: [] },
  pulse_signatures: { parent: true, filters: [] },
  pulse_witnesses: { parent: true, filters: [] },
  lifetree_loves: { parent: true, filters: [] },
  vision_loves: { parent: true, filters: [] },
  pulse_loves: { parent: true, filters: [] },
  community_loves: { parent: true, filters: [] },
  light_house_loves: { parent: true, filters: [] },
  lifetree_occupancy: { parent: true, filters: [] },
  bed_holds: { parent: true, filters: [] },
  stays: { filters: ['uid', 'hostUid', 'bedId', 'lightHouseId', 'status'] },
  supports: { filters: [] },
  rays: { filters: ['holderUid', 'treeId', 'sourceUid'] },
  glow: { filters: [] },
  gifts: { filters: ['giverUid', 'offeringId'] },
  spends: { filters: ['decisionId', 'offeringId'] },
  network_invites: { filters: ['email', 'invitedByUserId', 'status', 'acceptedByUserId'] },
  community_tree_invites: { filters: ['lifetreeId', 'invitedUserId', 'communityId', 'status', 'invitedByUserId'] },
  community_keeper_invites: { filters: ['communityId', 'invitedUserId', 'invitedByUserId', 'status'] },
  invite_requests: { filters: ['status', 'email'] },
  collabs: { filters: ['createdBy', 'communityId'] },
  intelligences: { filters: ['authorId', 'public', 'credentialScope', 'credentialHolderUid', 'communityId'] },
  personas: { filters: [] },
  memories: { filters: ['visibility', 'communityId', 'authorId'] },
  subscriptions: { filters: ['email', 'domain', 'active', 'uid'] },
  person_keys: { parent: true, filters: [] },
  person_key_events: { parent: true, filters: [] },
  push_subscriptions: { parent: true, filters: [] },
});

// The five beings a heart may be laid on (love_toggle), by the Firestore collection name.
export const SEED_LOVE_KINDS = Object.freeze(['lifetrees', 'visions', 'pulses', 'communities', 'lightHouses']);

// A patch value that is an INSTRUCTION, not a value (the Firestore sentinels, spoken as JSON).
export const docSentinel = Object.freeze({
  serverTime: () => ({ $op: 'serverTime' }),
  deleteField: () => ({ $op: 'delete' }),
  arrayUnion: (...values) => ({ $op: 'arrayUnion', values }),
  arrayRemove: (...values) => ({ $op: 'arrayRemove', values }),
  increment: by => ({ $op: 'increment', by }),
});

// GET /v1/docs/<collection>?id=… | ?parent=…&f.<field>=…&has.<field>=…&in.<field>=a,b&order=newest&after=…&limit=…
export function seedDocsQuery(collection, params) {
  const spec = Object.hasOwn(SEED_DOC_COLLECTIONS, collection) ? SEED_DOC_COLLECTIONS[collection] : null;
  if (!spec) return null;
  const equals = {}, contains = {}, within = {};
  let order = 'id';
  for (const key of params.keys()) {
    if (params.getAll(key).length !== 1) return null;
    const value = params.get(key);
    if (key === 'id' || key === 'parent' || key === 'after') { if (!identifier(value, key === 'after' ? 1024 : 512)) return null; continue; }
    if (key === 'limit') { if (!/^(?:[1-9]|[1-9][0-9]|100)$/.test(value)) return null; continue; }
    if (key === 'order') { if (!['id', 'newest'].includes(value)) return null; order = value; continue; }
    const dot = key.indexOf('.');
    const kind = dot > 0 ? key.slice(0, dot) : '', field = dot > 0 ? key.slice(dot + 1) : '';
    if (!fieldName(field)) return null;
    if (kind === 'f' && spec.filters.includes(field)) { if (!identifier(value)) return null; equals[field] = value; continue; }
    if (kind === 'has' && (spec.arrays ?? []).includes(field)) { if (!identifier(value)) return null; contains[field] = value; continue; }
    if (kind === 'in' && spec.filters.includes(field)) {
      const values = value.split(',');
      if (values.length < 1 || values.length > 10 || values.some(v => !identifier(v)) || new Set(values).size !== values.length) return null;
      within[field] = values; continue;
    }
    return null;
  }
  if (!!spec.parent !== params.has('parent')) return null;
  if (params.has('id') && (Object.keys(equals).length || Object.keys(contains).length || Object.keys(within).length || params.has('after') || params.has('limit') || params.has('order'))) return null;
  let after = null;
  if (params.has('after')) {
    const raw = params.get('after');
    if (order === 'newest') {
      try {
        const cursor = JSON.parse(raw);
        if (!Array.isArray(cursor) || cursor.length !== 2 || typeof cursor[0] !== 'string' || !identifier(cursor[1])
          || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(cursor[0]) || !Number.isFinite(Date.parse(cursor[0]))) return null;
        after = { moment: cursor[0], id: cursor[1] };
      } catch { return null; }
    } else after = raw;
  }
  return { kind: 'docs', collection, id: params.get('id'), parent: params.get('parent') ?? null, equals, contains, within,
    newest: order === 'newest', after, limit: Number(params.get('limit') ?? 50) };
}

const isJson = (value, depth = 0) => {
  if (depth > 32) return false;
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(v => isJson(v, depth + 1));
  if (typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) return false;
  return Object.entries(value).every(([k, v]) => k.length > 0 && k.length <= 256 && isJson(v, depth + 1));
};
const isDocument = value => !!value && typeof value === 'object' && !Array.isArray(value) && isJson(value)
  && Object.keys(value).every(fieldName) && !('id' in value);
// A patch names top-level fields or dotted paths into nested maps (Firestore's update).
const isPatch = value => !!value && typeof value === 'object' && !Array.isArray(value) && isJson(value)
  && Object.keys(value).length > 0 && Object.keys(value).every(k => k.split('.').every(fieldName)) && !('id' in value);

// POST /v1/docs/command — a document write as a claim; the SQL law decides.
export function seedDocCommand(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (value.action === 'love') {
    if (Object.keys(value).some(k => !['action', 'kind', 'id'].includes(k)) || !SEED_LOVE_KINDS.includes(value.kind) || !identifier(value.id)) return null;
    return { action: 'love', kind: value.kind, id: value.id };
  }
  const spec = Object.hasOwn(SEED_DOC_COLLECTIONS, value.collection) ? SEED_DOC_COLLECTIONS[value.collection] : null;
  if (!spec || !['create', 'set', 'update', 'delete'].includes(value.action)) return null;
  const fields = ['action', 'collection', 'id', ...(spec.parent ? ['parent'] : []),
    ...(value.action === 'create' || value.action === 'set' ? ['data'] : []), ...(value.action === 'set' ? ['merge'] : []),
    ...(value.action === 'update' ? ['patch'] : []), ...(value.action !== 'create' ? ['expect'] : [])];
  if (Object.keys(value).some(k => !fields.includes(k))) return null;
  if (!!spec.parent !== (value.parent !== undefined) || (spec.parent && !identifier(value.parent))) return null;
  if (value.id !== undefined ? !identifier(value.id) : value.action !== 'create') return null;
  if ((value.action === 'create' || value.action === 'set') && !isDocument(value.data)) return null;
  if (value.action === 'update' && !isPatch(value.patch)) return null;
  if (value.merge !== undefined && typeof value.merge !== 'boolean') return null;
  if (value.expect !== undefined && !isDocument(value.expect)) return null;
  return { ...value };
}
