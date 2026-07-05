// The data model — the "crystal". A structured, single-source description of the lifeseed
// entities and how they link, used both to render the in-app diagram and to emit a draw.io
// (mxGraph) XML you can open/edit in diagrams.net. Positions are the diagram layout (top-left of
// each box, on a ~1440×760 canvas).

export interface ModelField {
  name: string;
  type: string;
  ref?: string; // key of the entity this field points at (a relationship)
  pk?: boolean; // part of the document id
  many?: boolean; // an array of refs
}

export interface ModelEntity {
  key: string;
  label: string;
  collection: string; // Firestore collection
  note?: string; // subtypes / clarifications
  x: number;
  y: number;
  fields: ModelField[];
}

export const DATA_MODEL: ModelEntity[] = [
  {
    key: 'Person', label: 'Person', collection: 'persons', x: 40, y: 300,
    note: 'canonical identity (doc id = uid)',
    fields: [
      { name: 'uid', type: 'string', pk: true },
      { name: 'lid', type: 'uuidv7' },
      { name: 'displayName', type: 'string' },
      { name: 'publicKeyPem', type: 'string?' },
    ],
  },
  {
    key: 'Community', label: 'Community', collection: 'communities', x: 700, y: 40,
    note: 'a node — drives its domain',
    fields: [
      { name: 'id', type: 'string', pk: true },
      { name: 'ownerId', type: 'uid', ref: 'Person' },
      { name: 'name', type: 'string' },
      { name: 'domain', type: 'string' },
      { name: 'chainLocked', type: 'bool?' },
      { name: 'tokenisationEnabled', type: 'bool?' },
    ],
  },
  {
    key: 'Lifetree', label: 'Lifetree', collection: 'lifetrees', x: 700, y: 320,
    note: 'the seed — carries its own chain',
    fields: [
      { name: 'id', type: 'string', pk: true },
      { name: 'ownerId', type: 'uid', ref: 'Person' },
      { name: 'communityId', type: 'string?', ref: 'Community' },
      { name: 'validated', type: 'bool' },
      { name: 'validatorId', type: 'string?', ref: 'Lifetree' },
      { name: 'genesisHash', type: 'string' },
      { name: 'latestHash', type: 'string' },
      { name: 'blockHeight', type: 'number' },
      { name: 'guardians[]', type: 'uid[]', ref: 'Person', many: true },
    ],
  },
  {
    key: 'Vision', label: 'Vision', collection: 'visions', x: 1050, y: 40,
    fields: [
      { name: 'id', type: 'string', pk: true },
      { name: 'lifetreeId', type: 'string?', ref: 'Lifetree' },
      { name: 'authorId', type: 'uid', ref: 'Person' },
      { name: 'communityId', type: 'string?', ref: 'Community' },
      { name: 'title', type: 'string' },
      { name: 'body', type: 'string' },
    ],
  },
  {
    key: 'Pulse', label: 'Pulse', collection: 'pulses', x: 700, y: 660,
    note: 'block on a tree chain · subtypes: growth · event · reach · decision',
    fields: [
      { name: 'id', type: 'string', pk: true },
      { name: 'lifetreeId', type: 'string', ref: 'Lifetree' },
      { name: 'authorId', type: 'uid', ref: 'Person' },
      { name: 'communityId', type: 'string?', ref: 'Community' },
      { name: 'type', type: 'PulseType' },
      { name: 'hash', type: 'string' },
      { name: 'previousHash', type: 'string' },
      { name: 'visibility', type: 'enum' },
    ],
  },
  {
    key: 'Alignment', label: 'Alignment', collection: 'alignments', x: 1050, y: 540,
    note: 'a mutual sync between two trees',
    fields: [
      { name: 'id', type: 'string', pk: true },
      { name: 'initiatorTreeId', type: 'id', ref: 'Lifetree' },
      { name: 'targetTreeId', type: 'id', ref: 'Lifetree' },
      { name: 'initiatorUid', type: 'uid', ref: 'Person' },
      { name: 'targetUid', type: 'uid', ref: 'Person' },
      { name: 'status', type: 'enum' },
    ],
  },

  // --- Identity & account ---------------------------------------------------
  {
    key: 'User', label: 'User', collection: 'users', x: 40, y: 540,
    note: 'account profile (doc id = uid)',
    fields: [
      { name: 'uid', type: 'string', ref: 'Person', pk: true },
      { name: 'email', type: 'string' },
      { name: 'displayName', type: 'string' },
      { name: 'invitesRemaining', type: 'number' },
      { name: 'onlyValidatedCanReach', type: 'bool?' },
      { name: 'emailNotifications', type: 'map' },
      { name: 'newsletterSubscribed', type: 'bool' },
      { name: 'preferredIntelligenceId', type: 'string?', ref: 'Intelligence' },
      { name: 'siteTheme', type: 'map?' },
    ],
  },
  {
    key: 'Admin', label: 'Admin', collection: 'admins', x: 40, y: 900,
    note: 'staff roster — existence = staff',
    fields: [{ name: 'uid', type: 'string', ref: 'Person', pk: true }],
  },
  {
    key: 'Config', label: 'Config', collection: 'config', x: 40, y: 1040,
    note: 'config/superadmin singleton',
    fields: [
      { name: 'id', type: '"superadmin"', pk: true },
      { name: 'uid', type: 'uid', ref: 'Person' },
    ],
  },

  // --- Sanctuary & engagement ----------------------------------------------
  {
    key: 'Sanctuary', label: 'Sanctuary', collection: 'sanctuaries', x: 1050, y: 300,
    note: 'a sacred place on a domain',
    fields: [
      { name: 'id', type: 'string', pk: true },
      { name: 'ownerId', type: 'uid', ref: 'Person' },
      { name: 'name', type: 'string' },
      { name: 'body', type: 'string' },
      { name: 'domain', type: 'string?' },
      { name: 'locationName', type: 'string?' },
    ],
  },
  {
    key: 'Love', label: 'Love', collection: 'pulses/{id}/loves', x: 700, y: 940,
    note: 'like on a pulse (doc id = uid)',
    fields: [
      { name: 'uid', type: 'string', ref: 'Person', pk: true },
      { name: 'createdAt', type: 'timestamp' },
    ],
  },

  // --- Invitations ----------------------------------------------------------
  {
    key: 'TreeInvite', label: 'Tree Invite', collection: 'treeOwnershipInvites', x: 1400, y: 40,
    note: 'invite to a tree circle role',
    fields: [
      { name: 'id', type: 'string', pk: true },
      { name: 'lifetreeId', type: 'id', ref: 'Lifetree' },
      { name: 'invitedByUserId', type: 'uid', ref: 'Person' },
      { name: 'invitedUserId', type: 'uid', ref: 'Person' },
      { name: 'role', type: 'co_owner|steward|observer' },
      { name: 'status', type: 'enum' },
    ],
  },
  {
    key: 'NetworkInvite', label: 'Network Invite', collection: 'networkInvites', x: 1400, y: 300,
    note: 'onboarding token',
    fields: [
      { name: 'id', type: 'token', pk: true },
      { name: 'email', type: 'string' },
      { name: 'invitedByUserId', type: 'uid', ref: 'Person' },
      { name: 'acceptedByUserId', type: 'uid?', ref: 'Person' },
      { name: 'status', type: 'enum' },
      { name: 'message', type: 'string' },
    ],
  },
  {
    key: 'InviteRequest', label: 'Invite Request', collection: 'inviteRequests', x: 1400, y: 540,
    note: 'a request to join',
    fields: [
      { name: 'id', type: 'string', pk: true },
      { name: 'email', type: 'string' },
      { name: 'reason', type: 'string' },
      { name: 'status', type: 'enum' },
      { name: 'approvedBy', type: 'uid?', ref: 'Person' },
    ],
  },

  // --- Intelligence commons -------------------------------------------------
  {
    key: 'Intelligence', label: 'Intelligence', collection: 'intelligences', x: 1750, y: 40,
    note: 'a configured AI',
    fields: [
      { name: 'id', type: 'string', pk: true },
      { name: 'ownerId', type: 'uid?', ref: 'Person' },
      { name: 'name', type: 'string' },
      { name: 'provider', type: 'enum' },
      { name: 'model', type: 'string' },
      { name: 'public', type: 'bool' },
      { name: 'personaId', type: 'string?', ref: 'Persona' },
      { name: 'communityIds[]', type: 'id[]', ref: 'Community', many: true },
      { name: 'memoryIds[]', type: 'id[]', ref: 'Memory', many: true },
    ],
  },
  {
    key: 'Persona', label: 'Persona', collection: 'personas', x: 1750, y: 400,
    note: 'behaviour template (staff)',
    fields: [
      { name: 'id', type: 'string', pk: true },
      { name: 'name', type: 'string' },
      { name: 'description', type: 'string' },
      { name: 'systemPrompt', type: 'string' },
    ],
  },
  {
    key: 'Memory', label: 'Memory', collection: 'memories', x: 1750, y: 600,
    note: 'what an intelligence recalls',
    fields: [
      { name: 'id', type: 'string', pk: true },
      { name: 'name', type: 'string' },
      { name: 'text', type: 'string?' },
      { name: 'visibility', type: 'enum' },
      { name: 'communityId', type: 'string?', ref: 'Community' },
      { name: 'sourceIds[]', type: 'id[]' },
    ],
  },
  {
    key: 'ProviderCredential', label: 'Provider Credential', collection: 'providerCredentials', x: 1750, y: 850,
    note: 'server-only · API keys',
    fields: [
      { name: 'id', type: 'scope_owner_provider', pk: true },
      { name: 'provider', type: 'enum' },
      { name: 'scope', type: 'user|community' },
      { name: 'ownerId', type: 'id', ref: 'Person' },
      { name: 'keyHint', type: 'string' },
      { name: 'key', type: 'secret 🔒' },
    ],
  },

  // --- System (server-written) ----------------------------------------------
  {
    key: 'Link', label: 'Link (LIN)', collection: 'links', x: 360, y: 560,
    note: 'a relationship is itself an entity',
    fields: [
      { name: 'id', type: 'from__rel__to', pk: true },
      { name: 'from', type: 'id', ref: 'Person' },
      { name: 'rel', type: 'guardian|member|…' },
      { name: 'to', type: 'id', ref: 'Lifetree' },
      { name: 'weight', type: 'number?' },
    ],
  },
  {
    key: 'Mail', label: 'Mail', collection: 'mail', x: 360, y: 860,
    note: 'server-only · outbound queue',
    fields: [
      { name: 'id', type: 'string', pk: true },
      { name: 'uid', type: 'uid?', ref: 'Person' },
      { name: 'to', type: 'string[]' },
      { name: 'message', type: 'map' },
      { name: 'delivery', type: 'map (ext)' },
    ],
  },
  {
    key: 'Usage', label: 'Usage', collection: 'usage', x: 360, y: 1090,
    note: 'server-only · daily quota (id = uid)',
    fields: [
      { name: 'uid', type: 'string', ref: 'Person', pk: true },
      { name: 'day', type: 'yyyy-mm-dd' },
      { name: 'dailyAiText', type: 'number' },
      { name: 'dailyAiImage', type: 'number' },
      { name: 'dailyEmail', type: 'number' },
    ],
  },
  {
    key: 'Subscription', label: 'Subscription', collection: 'subscriptions', x: 700, y: 1090,
    note: 'newsletter (id = enc email)',
    fields: [
      { name: 'id', type: 'enc(email)', pk: true },
      { name: 'email', type: 'string' },
      { name: 'active', type: 'bool' },
      { name: 'uid', type: 'uid?', ref: 'Person' },
    ],
  },
];

export interface ModelRelation {
  from: string; // entity key
  to: string;   // entity key
  label: string;
  many?: boolean;
  lin?: boolean; // a polymorphic LIN edge (drawn dashed)
}

// Relations derived from every ref field, plus the polymorphic LIN edges the `links` collection
// forms (from a Person to any target). Self-references (validatorId) are kept — they're real.
export const DATA_RELATIONS: ModelRelation[] = (() => {
  const rels: ModelRelation[] = [];
  for (const e of DATA_MODEL) {
    for (const f of e.fields) {
      if (f.ref) rels.push({ from: e.key, to: f.ref, label: f.name, many: f.many });
    }
  }
  // The LIN connects a Person to communities / visions / events beyond the single `to` ref above.
  rels.push({ from: 'Link', to: 'Community', label: 'to', lin: true });
  rels.push({ from: 'Link', to: 'Vision', label: 'to', lin: true });
  // Love is a subcollection of Pulse (pulses/{id}/loves/{uid}).
  rels.push({ from: 'Love', to: 'Pulse', label: 'of' });
  return rels;
})();
