// THE INDEPENDENT NODE'S HAND for trees — the mirror of ../firebase/trees.ts (rings 2026-11-01/02).
// Reads come through /v1/trees (migrations 010, 024, 026) and the document door; planting is the
// server's one transaction (migration 011) with the photo attached after birth (020); every other
// tree edit, the beds, the Light Houses, the circle's invitations and the staff roster go through
// the document door (./docs), where seed.doc_write judges each write by the law firestore.rules
// kept — a carer edits, the head never moves from a client, a secret stays secret.
import type * as F from '../firebase/trees';
import { session, readDoc, readAll, currentUid, requireUid, toMillis } from './core';
import { docGet, docList, docAll, docCommand, serverTime } from './docs';
import { graphStore } from './store';
import { announce } from '../refreshBus';
import { tendedTreeRoles } from '../../domain/treeCircle';
import { mergeLinks } from '../../domain/secretTree';
import { DEFAULT_NODE_LIMITS, normalizeNodeLimits } from '../../domain/limits';
import { BED_DEFAULT_VISIBILITY, BED_TREE_TYPE, bedPlantingProblem, excludeBedTrees, isBedTree, isRealPlace } from '../../domain/bed';
import { LIGHT_HOUSE_ROOT } from '../../domain/lightHouse';
import { createBlock } from '../../utils/crypto';
import { uuidv7 } from '../../utils/id';
import type { Lifetree, LightHouse, TreeKeepingInvite } from '../../types';
import { myNaming, myPublicName } from './accounts';
export type { VisibleLightHouseOpts, TendedTree, TreePageCursor } from '../firebase/trees';

const TREES = '/v1/trees';
const treeById = (id: string) => readDoc<Lifetree>(`${TREES}?id=${encodeURIComponent(id)}`, 'tree');
const treesWhere = (params: Record<string, string>) => readAll<Lifetree>(TREES, 'trees', params);
const notBeds = (trees: Lifetree[]) => trees.filter(t => t.treeType !== 'BED');
const byIds = async (ids: Iterable<string>): Promise<Lifetree[]> =>
    (await Promise.all([...new Set(ids)].map(id => treeById(id).catch(() => null)))).filter((t): t is Lifetree => !!t);
const mediaPathOf = (url: unknown): string | null => {
    if (typeof url !== 'string' || !url) return null;
    try { return new URL(url, window.location.origin).searchParams.get('path'); } catch { return null; }
};
const byBirth = <T extends { createdAt?: unknown }>(items: T[]) => items.sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt));
const newestFirst = <T extends { createdAt?: unknown }>(items: T[]) => items.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));

export const MAHAMERU_IMAGE: typeof F.MAHAMERU_IMAGE = '/mahameru.svg';
// THE GENESIS and the initiates' mirror are the origin node's own ceremonies (Mahameru, the git
// ledger): an independent node has neither until its own first-keeper bootstrap, so at boot these
// have nothing to ensure and say so by doing nothing.
export const ensureGenesis: typeof F.ensureGenesis = async () => {};
export const syncInitiatesMirror: typeof F.syncInitiatesMirror = async () => {};
export const getGenesisHash: typeof F.getGenesisHash = async () => null;
export const getNetworkStats: typeof F.getNetworkStats = async (domain) => {
    const d = domain?.replace(/^www\./, '');
    const scope: Record<string, string> = d ? { domain: d } : {};
    const [trees, pulses, visions] = await Promise.all([
        treesWhere(scope).catch(() => [] as Lifetree[]),
        readAll<{ id: string }>('/v1/pulses', 'pulses', scope).catch(() => []),
        readAll<{ id: string }>('/v1/visions', 'visions', scope).catch(() => []),
    ]);
    return { trees: notBeds(trees).length, pulses: pulses.length, visions: visions.length };
};
// The node's caps (config/limits, world-readable); staff set them through the door.
export const getNodeLimits: typeof F.getNodeLimits = async () => {
    try { const limits = await docGet('config', 'limits'); return limits ? normalizeNodeLimits(limits) : DEFAULT_NODE_LIMITS; }
    catch { return DEFAULT_NODE_LIMITS; }
};
export const setNodeLimits: typeof F.setNodeLimits = async (limits) => {
    await docCommand({ action: 'set', collection: 'config', id: 'limits', merge: true, data: { ...normalizeNodeLimits(limits) } });
};
export const setNodeAiValidatedOnly: typeof F.setNodeAiValidatedOnly = async (value) => {
    await docCommand({ action: 'set', collection: 'config', id: 'limits', merge: true, data: { nodeAiValidatedOnly: value } });
};
// PLANTING is the server's one transaction (migration 011): identity, genesis, Root Vision and the
// guardian follow are born there; the photo is attached after birth (020); the rest of the shell's
// first words (short title, image) are laid on the tree through the door.
export const plantLifetree: typeof F.plantLifetree = async (data) => {
    const treeType = (data.treeType as 'LIFETREE' | 'GUARDED' | 'SECRET' | undefined) || (data.isNature ? 'GUARDED' : 'LIFETREE');
    const place = typeof data.latitude === 'number' && typeof data.longitude === 'number'
        ? { latitude: data.latitude, longitude: data.longitude } : {};
    const born = await session.treeCommand({
        action: 'plant', name: data.name, body: data.body ?? '', treeType,
        visibility: treeType === 'SECRET' ? 'private' : (data.visibility || 'public'),
        ...place, ...(data.locationName ? { locationName: data.locationName } : {}),
    }) as { tree: { id: string } };
    const picture = mediaPathOf(data.imageUrl);
    if (picture) await session.treeCommand({ action: 'set_pictures', id: born.tree.id, paths: [picture] }).catch(() => {});
    const extras: Record<string, unknown> = {};
    for (const key of ['shortTitle', 'webLinks', 'plantedAt', 'plantedLatitude', 'plantedLongitude', 'plantedAltitudeM'] as const) {
        if ((data as Record<string, unknown>)[key] !== undefined) extras[key] = (data as Record<string, unknown>)[key];
    }
    if (Object.keys(extras).length) await docCommand({ action: 'update', collection: 'lifetrees', id: born.tree.id, patch: extras }).catch(() => {});
    announce('trees', born.tree.id);
    return { id: born.tree.id } as unknown as Awaited<ReturnType<typeof F.plantLifetree>>;
};
// A BED — housed or loose — is born through the door; the rule holds the keeper, the place and the caps.
export const plantBed: typeof F.plantBed = async (draft) => {
    const uid = currentUid();
    if (!uid) throw new Error('err_signin_bed');
    const refusal = bedPlantingProblem(draft);
    if (refusal) throw new Error(refusal);
    if (draft.lightHouseId) {
        const house = await getLightHouseById(draft.lightHouseId);
        if (!house) throw new Error('err_lighthouse_gone');
        if (house.anchorUid !== uid) throw new Error('err_bed_keeper_only');
    }
    const hasPlace = isRealPlace(draft.latitude, draft.longitude);
    const genesisHash = await createBlock('0', { msg: 'Birth' }, Date.now());
    const born = await docCommand({ action: 'create', collection: 'lifetrees', data: {
        lid: uuidv7(), anchorUid: uid, name: draft.name.trim(),
        ...(draft.imageUrl ? { imageUrl: draft.imageUrl } : {}),
        ...(draft.imageUrls?.length ? { imageUrls: draft.imageUrls } : {}),
        body: draft.body?.trim() || '', treeType: BED_TREE_TYPE, domain: '',
        ...(draft.lightHouseId ? { lightHouseId: draft.lightHouseId } : {}),
        ...(hasPlace ? { latitude: draft.latitude, longitude: draft.longitude } : {}),
        ...(draft.locationName?.trim() ? { locationName: draft.locationName.trim() } : {}),
        visibility: BED_DEFAULT_VISIBILITY, createdAt: serverTime(), genesisHash, latestHash: genesisHash, blockHeight: 0,
        validated: false, validatorId: null, status: 'HEALTHY',
    } });
    return { id: born.id } as unknown as Awaited<ReturnType<typeof F.plantBed>>;
};
export const getMyBeds: typeof F.getMyBeds = async (uid) => byBirth((await treesWhere({ anchor: uid, kind: 'BED' })).filter(isBedTree));
export const getBedsForLightHouse: typeof F.getBedsForLightHouse = async (lightHouseId) =>
    byBirth((await docAll<Lifetree>('lifetrees', { where: { treeType: BED_TREE_TYPE, lightHouseId } })).filter(isBedTree));
export const fetchPublicBeds: typeof F.fetchPublicBeds = async (max = 48) =>
    byBirth((await docList<Lifetree>('lifetrees', { where: { treeType: BED_TREE_TYPE, visibility: 'public' }, limit: Math.min(max, 100) })).items.filter(isBedTree));
// Every edit through the door: the rule keeps what is frozen frozen (anchor, validation, the head).
export const updateLifetree: typeof F.updateLifetree = async (id, data) => {
    await docCommand({ action: 'update', collection: 'lifetrees', id, patch: { ...data } as Record<string, unknown> });
    announce('trees', id, data as Record<string, unknown>);
};
export const deleteLifetree: typeof F.deleteLifetree = async (id) => { await docCommand({ action: 'delete', collection: 'lifetrees', id }); };
export const validateLifetree: typeof F.validateLifetree = async (targetId, validatorId) => {
    await docCommand({ action: 'update', collection: 'lifetrees', id: targetId, patch: { validated: true, validatorId } });
};
export const unvalidateLifetree: typeof F.unvalidateLifetree = async (targetId) => {
    await docCommand({ action: 'update', collection: 'lifetrees', id: targetId, patch: { validated: false, validatorId: null } });
};
// The forest's pages, newest first on the node; the creator's own trees merge onto a scoped first page.
export const fetchLifetrees: typeof F.fetchLifetrees = async (lastD, domainFilter, anchorUid) => {
    const scopedDomain = domainFilter?.replace(/^www\./, '');
    const page = await docList<Lifetree>('lifetrees', { where: scopedDomain ? { domain: scopedDomain } : {}, newest: true, limit: scopedDomain ? 24 : 12,
        after: (lastD ?? null) as unknown as [string, string] | null });
    let items = page.items;
    if (scopedDomain && anchorUid && !lastD) {
        const mine = await docAll<Lifetree>('lifetrees', { where: { anchorUid } }).catch(() => []);
        const seen = new Set(items.map(t => t.id));
        for (const t of mine) if (!seen.has(t.id)) items.push(t);
        items = newestFirst(items);
    }
    return { items: excludeBedTrees(items), lastDoc: (page.next ?? null) as unknown as F.TreePageCursor | null };
};
export const fetchAllLifetrees: typeof F.fetchAllLifetrees = async (domainFilter, anchorUid) => {
    const byId = new Map<string, Lifetree>();
    for (const t of await treesWhere(domainFilter ? { domain: domainFilter.replace(/^www\./, '') } : {})) byId.set(t.id, t);
    if (anchorUid) for (const t of await treesWhere({ anchor: anchorUid })) byId.set(t.id, t);
    return excludeBedTrees([...byId.values()]);
};
// A tree stands in another community's garden through the link command (migration 024).
export const standTreeInCommunity: typeof F.standTreeInCommunity = (treeId, communityId) => graphStore.link(treeId, 'grows_in', communityId);
export const withdrawTreeFromCommunity: typeof F.withdrawTreeFromCommunity = (treeId, communityId) => graphStore.unlink(treeId, 'grows_in', communityId);
export const communitiesTreeStandsIn: typeof F.communitiesTreeStandsIn = async (treeId) => (await graphStore.linksFrom(treeId, 'grows_in')).map(l => l.to);
export const treesStandingIn: typeof F.treesStandingIn = async (communityId) => treesWhere({ garden: communityId });
export const getMyLifetrees: typeof F.getMyLifetrees = async (uid) => notBeds(await treesWhere({ anchor: uid }));
export const normalizeDomain: typeof F.normalizeDomain = (domain) =>
    domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
export const getTreesByDomain: typeof F.getTreesByDomain = async (domain, anchorUid) =>
    treesWhere({ domain: normalizeDomain(domain), ...(anchorUid ? { anchor: anchorUid } : {}) });

// ── LIGHT HOUSES through the door: the rule reads the community's choice at rest ──────────
export const getLightHousesByDomain: typeof F.getLightHousesByDomain = async (domain) =>
    byBirth(await docAll<LightHouse>('light_houses', { where: { domain: normalizeDomain(domain) } }));
export const getRootedTrees: typeof F.getRootedTrees = async (lightHouseIds) => {
    if (!lightHouseIds.length) return [];
    const links = await Promise.all(lightHouseIds.map(id => graphStore.linksFrom(id, 'rooted').catch(() => [])));
    return (await byIds(links.flat().map(l => l.to))).filter(t => !isBedTree(t));
};
export const getAllLightHouses: typeof F.getAllLightHouses = async () => docAll<LightHouse>('light_houses');
export const createLightHouse: typeof F.createLightHouse = async (data) => {
    const born = await docCommand({ action: 'create', collection: 'light_houses', data: {
        ...Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined && v !== '')), lid: uuidv7(), createdAt: serverTime(),
    } });
    try { await mintLightHouseCare({ id: born.id, name: data.name, communityId: data.communityId }, 'consecration', { communityId: data.communityId }); } catch { /* the house stands regardless */ }
    return born.id;
};
export const getLightHouseById: typeof F.getLightHouseById = async (id) => docGet<LightHouse>('light_houses', id);
export const getLightHousesByCommunity: typeof F.getLightHousesByCommunity = async (communityId) => {
    const [primary, links] = await Promise.all([docAll<LightHouse>('light_houses', { where: { communityId } }), graphStore.linksTo(communityId, 'shelters')]);
    const out = new Map<string, LightHouse>(primary.map(h => [h.id, h]));
    const fetched = await Promise.all(links.map(l => l.from).filter(id => !out.has(id)).map(id => getLightHouseById(id).catch(() => null)));
    for (const h of fetched) if (h) out.set(h.id, h);
    return [...out.values()];
};
export const adoptLightHouse: typeof F.adoptLightHouse = async (lightHouseId, communityId) => {
    await graphStore.link(lightHouseId, 'shelters', communityId);
    try { await mintLightHouseCare({ id: lightHouseId, name: '', communityId }, 'step_in', { communityId }); } catch { /* the link is the act */ }
};
// A care act is a standalone record on the one ledger (LIGHT_HOUSE root); one gesture warms two beings.
export const mintLightHouseCare: typeof F.mintLightHouseCare = async (lightHouse, act, opts) => {
    const uid = requireUid();
    const communityId = opts?.communityId || lightHouse.communityId || '';
    const domain = window.location.hostname.toLowerCase().replace(/^www\./, '');
    const title = act === 'consecration' ? 'Consecration' : act === 'step_in' ? 'Step-in' : 'Care';
    const payload = { type: 'observation' as const, lightHouseId: lightHouse.id, ...(communityId ? { communityId } : {}), care: true, careAct: act,
        title, body: '', visibility: 'public' as const, domain, authorId: uid, authorName: (await myPublicName()) || '' };
    const hash = await createBlock(LIGHT_HOUSE_ROOT, payload, Date.now());
    const born = await docCommand({ action: 'create', collection: 'pulses', data: { ...payload, lid: uuidv7(), loveCount: 0, commentCount: 0, previousHash: LIGHT_HOUSE_ROOT, hash, createdAt: serverTime() } });
    try { await docCommand({ action: 'update', collection: 'light_houses', id: lightHouse.id, patch: { lastCaredAt: serverTime(), updatedAt: serverTime() } }); } catch { /* not this hand's house */ }
    if (communityId) { try { await docCommand({ action: 'update', collection: 'communities', id: communityId, patch: { lastCaredAt: serverTime(), updatedAt: serverTime() } }); } catch { /* not this hand's community */ } }
    return born.id;
};
export const getLightHouseCareRecord: typeof F.getLightHouseCareRecord = async (lightHouseId) => {
    const pulses = byBirth(await docAll<Record<string, unknown> & { id: string; createdAt?: unknown }>('pulses', { where: { lightHouseId, care: 'true', visibility: 'public' } }));
    const founding = pulses[0] as ({ id: string; authorId?: string; authorName?: string; careAct?: string } | undefined);
    if (!founding) return null;
    const witnesses = (await docAll<{ uid: string; lid: string; name?: string }>('pulse_witnesses', { parent: founding.id })).map(({ id: _id, ...w }) => { void _id; return w; });
    return { founding, witnesses };
};
export const witnessLightHouseCare: typeof F.witnessLightHouseCare = async (pulseId) => {
    const uid = requireUid();
    const person = await docGet<{ lid?: string }>('persons', uid);
    if (!person?.lid) throw new Error('err_no_person');
    const naming = await myNaming();
    await docCommand({ action: 'create', collection: 'pulse_witnesses', parent: pulseId, id: uid, data: { uid, lid: person.lid, ...(naming.name ? { name: naming.name } : {}), witnessedAt: serverTime() } });
};
export const updateLightHouse: typeof F.updateLightHouse = async (lightHouseId, data) => {
    await docCommand({ action: 'update', collection: 'light_houses', id: lightHouseId, patch: Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined && v !== '')) });
};
export const deleteLightHouse: typeof F.deleteLightHouse = async (lightHouseId) => {
    try {
        const links = await graphStore.linksFrom(lightHouseId);
        await Promise.all(links.filter(l => ['rooted', 'shelters'].includes(l.rel)).map(l => graphStore.unlink(lightHouseId, l.rel, l.to).catch(() => {})));
    } catch { /* best-effort — staff may clean later */ }
    await docCommand({ action: 'delete', collection: 'light_houses', id: lightHouseId });
};
export const setLightHouseVisibility: typeof F.setLightHouseVisibility = async (lightHouseId, visibility) => {
    await docCommand({ action: 'update', collection: 'light_houses', id: lightHouseId, patch: { visibility } });
};

// ── STAFF standing, from the node's governed records (admins, config/superadmin) ───────────
export const checkIsAdmin: typeof F.checkIsAdmin = async (uid) => !!(await docGet('admins', uid).catch(() => null));
export const getSuperAdminUid: typeof F.getSuperAdminUid = async () => (await docGet<{ uid?: string }>('config', 'superadmin').catch(() => null))?.uid ?? null;
export const checkIsSuperAdmin: typeof F.checkIsSuperAdmin = async (uid) => (await getSuperAdminUid()) === uid;
export const SUPERADMIN_INVITE_ALLOTMENT: typeof F.SUPERADMIN_INVITE_ALLOTMENT = 144;
// The first keeper is appointed by the installation (npm run seed:keeper — the hand that holds the
// database), never by a public first-visitor claim: this answers no. The staff roster is the
// keeper's hand through /v1/staff/command (migration 054): the node judges who asks.
// THE LAST HANDS (ring 2026-11-03): the answer is the node's, not a refusal — nobody claims here, so the claim is never granted.
export const claimSuperAdmin: typeof F.claimSuperAdmin = async () => { console.info('[lightseed] the keeper of this node is appointed by the installation (seed:keeper); nothing to claim'); return false; };
export const grantAdmin: typeof F.grantAdmin = async (uid) => { await session.staffCommand({ action: 'grant_admin', uid }); };
export const revokeAdmin: typeof F.revokeAdmin = async (uid) => { await session.staffCommand({ action: 'revoke_admin', uid }); };
export const getAdmins: typeof F.getAdmins = async () => (await docAll<{ id: string }>('admins')).map(a => ({ uid: a.id }));
// The circle's prisms: links first (the LIN), then the trees they name, each under the law.
export const getGuardedTrees: typeof F.getGuardedTrees = async (uid) =>
    (await byIds((await graphStore.linksFrom(uid, 'guardian')).map(l => l.to))).filter(t => !isBedTree(t));
export const getMyPrivateTreesAt: typeof F.getMyPrivateTreesAt = async (uid, domain) => {
    const place = normalizeDomain(domain);
    const out = new Map<string, Lifetree>();
    const take = (t: Lifetree) => { if (t.visibility === 'private' && t.treeType !== 'BED' && normalizeDomain(t.domain || '') === place) out.set(t.id, t); };
    for (const t of await docAll<Lifetree>('lifetrees', { where: { anchorUid: uid, visibility: 'private' } }).catch(() => [])) take(t);
    const [seats, secret] = await Promise.all([graphStore.linksFrom(uid).catch(() => []), graphStore.secretLinksFrom(uid).catch(() => [])]);
    const ids = new Set([...seats.filter(l => ['keeper', 'steward', 'guardian', 'observer'].includes(l.rel)).map(l => l.to), ...secret.map(l => l.to)]);
    for (const t of await byIds([...ids].filter(id => !out.has(id)))) take(t);
    return [...out.values()];
};
export const getMySecretTreesAt: typeof F.getMySecretTreesAt = async (uid, domain) => (await getMyPrivateTreesAt(uid, domain)).filter(t => t.treeType === 'SECRET');
export const getTendedTrees: typeof F.getTendedTrees = async (uid) => {
    const [keeper, steward, secret] = await Promise.all([
        graphStore.linksFrom(uid, 'keeper'), graphStore.linksFrom(uid, 'steward'), graphStore.secretLinksFrom(uid).catch(() => []),
    ]);
    const roles = tendedTreeRoles(mergeLinks([...keeper, ...steward], secret), uid);
    return (await byIds(roles.keys())).filter(t => !isBedTree(t) && t.anchorUid !== uid).map(tree => ({ tree, role: roles.get(tree.id)! }));
};
export const getParticipatingTrees: typeof F.getParticipatingTrees = async (entityId) => (await treesWhere({ participating: entityId })).filter(t => !isBedTree(t));

// ── Tree Circle invitations: the node's command (migration 015) carries them ───────────────
const inviteOf = (body: unknown) => (body as { invite: TreeKeepingInvite }).invite;
export const createTreeInvite: typeof F.createTreeInvite = async ({ lifetree, invitedUserId, role, message, invitedByUserId }) => {
    if (!invitedUserId.trim()) throw new Error('err_choose_invitee');
    if (invitedUserId === lifetree.anchorUid) throw new Error('err_keeper_already');
    if ((await graphStore.linksFrom(invitedUserId, role).catch(() => [])).some(l => l.to === lifetree.id)) throw new Error('err_role_already');
    if ((await getSentTreeInvites(lifetree.id).catch(() => [])).some(i => i.invitedUserId === invitedUserId && i.role === role && i.status === 'pending')) throw new Error('err_invite_pending_role');
    void invitedByUserId; // the node names the inviter from the session
    const born = await session.treeInviteCommand({ action: 'mint', treeId: lifetree.id, member: invitedUserId, open: false, role, ...(message ? { message } : {}) });
    return inviteOf(born).id;
};
export const mintOpenTreeInvite: typeof F.mintOpenTreeInvite = async ({ lifetree, role, message }) => {
    const born = await session.treeInviteCommand({ action: 'mint', treeId: lifetree.id, open: true, role, ...(message ? { message } : {}) });
    return inviteOf(born).id;
};
export const getTreeInvite: typeof F.getTreeInvite = (inviteId) => readDoc<TreeKeepingInvite>('/v1/tree-invites?id=' + encodeURIComponent(inviteId), 'invite');
export const claimTreeInvite: typeof F.claimTreeInvite = async (inviteId) => { await session.treeInviteCommand({ action: 'claim', id: inviteId }); };
export const getPendingTreeInvites: typeof F.getPendingTreeInvites = async () =>
    (await readAll<TreeKeepingInvite>('/v1/tree-invites', 'invites', { mine: 'true' })).filter(i => i.status === 'pending');
export const getSentTreeInvites: typeof F.getSentTreeInvites = async (lifetreeId) => newestFirst(await readAll<TreeKeepingInvite>('/v1/tree-invites', 'invites', { tree: lifetreeId }));
export const declineTreeInvite: typeof F.declineTreeInvite = async (inviteId) => { await session.treeInviteCommand({ action: 'decline', id: inviteId }); };
export const revokeTreeInvite: typeof F.revokeTreeInvite = async (inviteId) => { await session.treeInviteCommand({ action: 'revoke', id: inviteId }); };
// Acceptance writes the seat and the rooted circle in one transaction; the circle is read back by its root.
export const acceptTreeInvite: typeof F.acceptTreeInvite = async (inviteId) => {
    const answer = await session.treeInviteCommand({ action: 'accept', id: inviteId }) as { invite: TreeKeepingInvite; validated?: boolean; guardiansNeeded?: number };
    const circle = await docList<{ id: string }>('communities', { where: { rootLifetreeId: answer.invite.lifetreeId, formation: 'tree_keeping' }, limit: 1 }).catch(() => ({ items: [] }));
    return { communityId: circle.items[0]?.id ?? '', lifetreeId: answer.invite.lifetreeId, validated: answer.validated, guardiansNeeded: answer.guardiansNeeded };
};
export const setTreeStatus: typeof F.setTreeStatus = async (id, status) => { await docCommand({ action: 'update', collection: 'lifetrees', id, patch: { status } }); };
