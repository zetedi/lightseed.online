// THE INDEPENDENT NODE'S HAND for spaces — the mirror of ../firebase/spaces.ts (rings 2026-11-01/02).
// Communities come through /v1/communities and the community commands (migrations 005–009, 012–013,
// 017); visions through /v1/visions and the vision command (027–030); invitations, keeper offers
// and knocks through their own commands (007, 012, 013, 025); the circle's graduation and the
// gathering's circle through form_circle (017, 048). Everything a Firebase community did through
// documents — founding with its words, editing, the collabs, a tree's invitation — goes through
// the document door under the law. The DNS proofs and door grants wait for the domain organ.
import type * as F from '../firebase/spaces';
import { unported } from './unported';
import { session, readDoc, readAll, toMillis } from './core';
import { docGet, docList, docAll, docCommand, serverTime, deleteField } from './docs';
import { graphStore } from './store';
import { chooseDomainClaimant } from '../../domain/communityDoor';
import { isDomainVerified } from '../../domain/domainVerification';
import { nodeCapacityGate, DEFAULT_NODE_LIMITS } from '../../domain/limits';
import { createBlock } from '../../utils/crypto';
import { uuidv7 } from '../../utils/id';
import { getNodeLimits } from './trees';
import type { Community, CommunityInvite, Pulse, Vision } from '../../types';
export type { VisionFetchAccess, OrgCollab, CommunityTreeInvite, KeeperInvite, DomainChallengeRecord, DoorClaim, VisionPageCursor } from '../firebase/spaces';

const COMMUNITIES = '/v1/communities';
const VISIONS = '/v1/visions';
const createdMs = (c: { createdAt?: unknown }) => toMillis(c.createdAt);
const newestFirst = <T extends { createdAt?: unknown }>(items: T[]) => [...items].sort((a, b) => createdMs(b) - createdMs(a));
const normalizeDomain = (domain: string) => domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');

// Visions, newest first on the node (the policies filter), the author's own merged onto page one.
export const fetchVisions: typeof F.fetchVisions = async (lastD, domainFilter, access = {}) => {
    const normalized = domainFilter?.replace(/^www\./, '');
    const page = await docList<Vision>('visions', { where: normalized ? { domain: normalized } : {}, newest: true, limit: normalized ? 24 : 12,
        after: (lastD ?? null) as unknown as [string, string] | null });
    const byId = new Map(page.items.map(v => [v.id, v]));
    if (!lastD && access.uid && !access.isStaff) {
        for (const v of await docAll<Vision>('visions', { where: { authorId: access.uid } }).catch(() => [])) if (!normalized || v.domain === normalized) byId.set(v.id, v);
    }
    return { items: newestFirst([...byId.values()]), lastDoc: (page.next ?? null) as unknown as F.VisionPageCursor | null };
};
export const getMyVisions: typeof F.getMyVisions = (uid) => readAll<Vision>(VISIONS, 'visions', { author: uid });
export const getMyVisionCount: typeof F.getMyVisionCount = async (uid) => (await getMyVisions(uid)).length;
export const getJoinedVisions: typeof F.getJoinedVisions = (uid) => readAll<Vision>(VISIONS, 'visions', { joined: uid });
// Born on the server (migration 028): identity, author, grounding and genesis are its to give.
export const createVision: typeof F.createVision = async (data) => {
    const born = await session.visionCommand({ action: 'create', title: data.title, body: data.body ?? '', visibility: data.visibility || 'public' }) as { vision: { id: string } };
    const extras: Record<string, unknown> = {};
    for (const key of ['imageUrl', 'imageUrls', 'description', 'link', 'status'] as const) if (data[key] !== undefined) extras[key] = data[key];
    if (Object.keys(extras).length) await docCommand({ action: 'update', collection: 'visions', id: born.vision.id, patch: extras }).catch(() => {});
    return { id: born.vision.id } as unknown as Awaited<ReturnType<typeof F.createVision>>;
};
export const getVisionById: typeof F.getVisionById = (id) => readDoc<Vision>(VISIONS + '?id=' + encodeURIComponent(id), 'vision');
// RELEASE a vision (migration 030): the record goes, its chain stands, the incoming links are let go.
export const deleteVision: typeof F.deleteVision = async (id) => { await session.visionCommand({ action: 'release', id }); };
export const mendVisionDomain: typeof F.mendVisionDomain = async (visionId, domain) => {
    let communityId: string | undefined;
    try { communityId = (await getCommunityByDomain(domain))?.id; } catch { /* no match */ }
    await docCommand({ action: 'update', collection: 'visions', id: visionId, patch: { domain, communityId: communityId ?? deleteField(), updatedAt: serverTime() } });
};
export const fetchCommunities: typeof F.fetchCommunities = async () => newestFirst(await readAll<Community>(COMMUNITIES, 'communities'));
export const getCommunityByDomain: typeof F.getCommunityByDomain = async (domain) => {
    const normalized = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    const all = await fetchCommunities();
    const facts = (c: Community) => ({ verified: isDomainVerified(c), createdAtMs: createdMs(c) || Number.MAX_SAFE_INTEGER });
    const canonical = chooseDomainClaimant(all.filter(c => c.domain === normalized), facts);
    if (canonical) return canonical;
    return chooseDomainClaimant(all.filter(c => ((c as { domainAliases?: string[] }).domainAliases || []).includes(normalized)),
        c => ({ verified: false, createdAtMs: createdMs(c) || Number.MAX_SAFE_INTEGER }));
};
export const getCommunityById: typeof F.getCommunityById = (id) => readDoc<Community>(COMMUNITIES + '?id=' + encodeURIComponent(id), 'community');
export const getMyCommunities: typeof F.getMyCommunities = async (uid) => (await fetchCommunities()).filter(c => c.anchorUid === uid);
export const COMMUNITY_INVITE_ALLOTMENT: typeof F.COMMUNITY_INVITE_ALLOTMENT = 144;
// FOUNDING through the door with every word the founder gave; the law holds the anchor and the
// node's fullness (the capacity lock); the founder's invitation allowance rises to the allotment.
export const createCommunity: typeof F.createCommunity = async (data) => {
    const [existing, limits] = await Promise.all([fetchCommunities(), getNodeLimits().catch(() => DEFAULT_NODE_LIMITS)]);
    const hostedCount = existing.filter(c => (c as { formation?: string }).formation !== 'tree_keeping').length;
    const refusal = nodeCapacityGate({ hostedCount, faceCount: 0 }, 'community', limits);
    if (refusal) throw new Error(refusal);
    const lid = uuidv7();
    const born = await docCommand({ action: 'create', collection: 'communities', data: {
        ...data, bornOn: data.bornOn || window.location.hostname.toLowerCase().replace(/^www\./, ''), lid, createdAt: serverTime(), updatedAt: serverTime(),
    } as Record<string, unknown> });
    if (data.anchorUid) {
        try {
            const me = await docGet<{ invitesRemaining?: number }>('users', data.anchorUid);
            if (me && (me.invitesRemaining || 0) < COMMUNITY_INVITE_ALLOTMENT) await docCommand({ action: 'update', collection: 'users', id: data.anchorUid, patch: { invitesRemaining: COMMUNITY_INVITE_ALLOTMENT } });
        } catch (e) { console.warn('Could not grant community invite allotment', e); }
    }
    return { id: born.id, lid, ...data } as Community;
};
export const updateCommunity: typeof F.updateCommunity = async (id, data) => {
    await docCommand({ action: 'update', collection: 'communities', id, patch: { ...data, updatedAt: serverTime() } as Record<string, unknown> });
};
export const deleteCommunity: typeof F.deleteCommunity = async (id) => { await docCommand({ action: 'delete', collection: 'communities', id }); };
// THE DOOR's invitations are the node's command (migration 007): minted by a door keeper, one-way revoked.
export const mintCommunityInvite: typeof F.mintCommunityInvite = async (communityId, _createdBy, label, expiresAtMs) => {
    const born = await session.inviteCommand({ action: 'mint', communityId, ...(label ? { label } : {}), ...(expiresAtMs ? { expiresAt: new Date(expiresAtMs).toISOString() } : {}) }) as { invite: Record<string, unknown> & { id: string } };
    return born.invite as unknown as CommunityInvite;
};
export const getCommunityInvite: typeof F.getCommunityInvite = (inviteId) => readDoc<CommunityInvite>('/v1/community-invites?id=' + encodeURIComponent(inviteId), 'invite');
export const listCommunityInvites: typeof F.listCommunityInvites = async (communityId) => newestFirst(await readAll<CommunityInvite>('/v1/community-invites', 'invites', { community: communityId }));
export const revokeCommunityInvite: typeof F.revokeCommunityInvite = async (inviteId) => { await session.inviteCommand({ action: 'revoke', id: inviteId }); };
export const joinCommunityOpen: typeof F.joinCommunityOpen = async (_uid, communityId) => { await session.communityCommand({ action: 'join', id: communityId }); };
export const joinCommunityWithInvite: typeof F.joinCommunityWithInvite = async (_uid, invite) => {
    await session.inviteCommand({ action: 'accept', id: invite.id });
    return { remembered: true }; // migration 007 writes membership and arrival provenance together
};
export const getCommunityEvents: typeof F.getCommunityEvents = async (communityId) =>
    newestFirst(await readAll<Pulse>('/v1/pulses', 'pulses', { community: communityId, type: 'event' }));
// The staff sweeps are the installation's scripts, not a browser's hands, on this node.
export const backfillPulseVisibility: typeof F.backfillPulseVisibility = unported('spaces.backfillPulseVisibility');
export const migratePulseTypeCasing: typeof F.migratePulseTypeCasing = unported('spaces.migratePulseTypeCasing');
export const migrateTreeVisibility: typeof F.migrateTreeVisibility = unported('spaces.migrateTreeVisibility');
export const backfillVisionChains: typeof F.backfillVisionChains = unported('spaces.backfillVisionChains');
export const migrateBackfillLids: typeof F.migrateBackfillLids = unported('spaces.migrateBackfillLids');
// Organisation collabs — world-readable, cared for by their creator or staff.
export const getOrgCollabs: typeof F.getOrgCollabs = async () => (await docAll<F.OrgCollab>('collabs')).sort((a, b) => (createdMs(a) || 0) - (createdMs(b) || 0));
export const addOrgCollab: typeof F.addOrgCollab = async (data) => {
    if (!data.name.trim()) throw new Error('err_org_name');
    const born = await docCommand({ action: 'create', collection: 'collabs', data: {
        lid: uuidv7(), name: data.name.trim(), url: data.url?.trim() || '', blurb: data.blurb?.trim() || '', agreement: data.agreement,
        ...(data.logoUrl ? { logoUrl: data.logoUrl } : {}), createdBy: data.createdBy, createdAt: serverTime(),
    } });
    return born.id;
};
export const updateOrgCollab: typeof F.updateOrgCollab = async (id, data) => { await docCommand({ action: 'update', collection: 'collabs', id, patch: { ...data } }); };
export const removeOrgCollab: typeof F.removeOrgCollab = async (id) => { await docCommand({ action: 'delete', collection: 'collabs', id }); };
// A community invites a lifetree to stand with it; the tree's keeper answers with a participant link.
export const inviteTreeToCommunity: typeof F.inviteTreeToCommunity = async (params) => {
    const existing = await docAll<{ communityId?: string; status?: string }>('community_tree_invites', { where: { lifetreeId: params.lifetreeId } });
    if (existing.some(x => x.communityId === params.communityId && x.status === 'pending')) throw new Error('err_tree_invite_pending');
    if ((await graphStore.linksFrom(params.lifetreeId, 'participant')).some(l => l.to === params.communityId)) throw new Error('err_tree_already_community');
    const born = await docCommand({ action: 'create', collection: 'community_tree_invites', data: {
        communityId: params.communityId, communityName: params.communityName, lifetreeId: params.lifetreeId, lifetreeName: params.lifetreeName,
        invitedUserId: params.treeAnchorUid, invitedByUserId: params.invitedByUserId, status: 'pending', createdAt: serverTime(),
    } });
    return born.id;
};
export const getMyCommunityTreeInvites: typeof F.getMyCommunityTreeInvites = async (uid) =>
    (await docAll<F.CommunityTreeInvite>('community_tree_invites', { where: { invitedUserId: uid } })).filter(i => i.status === 'pending');
export const respondCommunityTreeInvite: typeof F.respondCommunityTreeInvite = async (invite, accept) => {
    if (accept) await graphStore.link(invite.lifetreeId, 'participant', invite.communityId);
    await docCommand({ action: 'update', collection: 'community_tree_invites', id: invite.id, patch: { status: accept ? 'accepted' : 'declined', respondedAt: serverTime() } });
};
// THE KEEPER CIRCLE: offers, knocks and resignation are the node's commands (009, 012, 013, 014, 025).
export const keepersOfCommunity: typeof F.keepersOfCommunity = async (community) => {
    const links = await graphStore.linksTo(community.id, 'keeper');
    const out = [community.anchorUid];
    for (const l of links) if (l.from && !out.includes(l.from)) out.push(l.from);
    return out;
};
export const inviteKeeper: typeof F.inviteKeeper = async (input) => { await session.communityCommand({ action: 'offer_keeper', id: input.communityId, member: input.invitedUserId }); };
const keeperInvites = (params: Record<string, string>) => readAll<F.KeeperInvite>('/v1/keeper-invites', 'invites', params);
export const fetchKeeperInvitesFor: typeof F.fetchKeeperInvitesFor = async () => (await keeperInvites({ mine: 'true' })).filter(i => i.status === 'pending');
export const fetchKeeperInvitesOf: typeof F.fetchKeeperInvitesOf = async (communityId) => (await keeperInvites({ community: communityId })).filter(i => i.status === 'pending');
const keeperInviteById = async (inviteId: string): Promise<F.KeeperInvite> => {
    const found = (await keeperInvites({ mine: 'true' })).find(i => i.id === inviteId);
    if (!found) throw new Error('invite_missing');
    return found;
};
export const declineKeeperInvite: typeof F.declineKeeperInvite = async (inviteId) => {
    const invite = await keeperInviteById(inviteId);
    await session.communityCommand({ action: 'decline_keeper_offer', id: invite.communityId, inviteId });
};
// A knock for keepership — at a community or at a lifetree: the target's own command answers.
const isCommunity = async (targetId: string) => !!(await getCommunityById(targetId).catch(() => null));
export const requestKeepership: typeof F.requestKeepership = async (_uid, targetId) => {
    if (await isCommunity(targetId)) await session.communityCommand({ action: 'request_keeper', id: targetId });
    else await session.treeCommand({ action: 'request_keeper', id: targetId });
};
export const withdrawKeeperRequest: typeof F.withdrawKeeperRequest = async (_uid, targetId) => {
    if (await isCommunity(targetId)) await session.communityCommand({ action: 'cancel_keeper_request', id: targetId });
    else await session.treeCommand({ action: 'cancel_keeper_request', id: targetId });
};
export const fetchKeeperRequests: typeof F.fetchKeeperRequests = (targetId) => graphStore.linksTo(targetId, 'keeper_request');
export const declineKeeperRequest: typeof F.declineKeeperRequest = async (requesterUid, targetId) => {
    if (await isCommunity(targetId)) await session.communityCommand({ action: 'decline_keeper_request', id: targetId, member: requesterUid });
    else await session.treeCommand({ action: 'decline_keeper_request', id: targetId, member: requesterUid });
};
export const acceptKeeperInvite: typeof F.acceptKeeperInvite = async (inviteId) => {
    const invite = await keeperInviteById(inviteId);
    await session.communityCommand({ action: 'accept_keeper_offer', id: invite.communityId, inviteId });
    return { communityId: invite.communityId };
};
export const resignTreeKeeper: typeof F.resignTreeKeeper = async (treeId) =>
    await session.treeCommand({ action: 'resign_keeper', id: treeId }) as { resigned: string; successor: string | null };
export const acceptKeeperRequest: typeof F.acceptKeeperRequest = async (communityId, requesterUid) => {
    const answer = await session.communityCommand({ action: 'accept_keeper_request', id: communityId, member: requesterUid }) as { member: string };
    return { keeperUid: answer.member };
};
export const resignKeeper: typeof F.resignKeeper = async (communityId) =>
    await session.communityCommand({ action: 'resign_keeper', id: communityId }) as { resigned: string; successor: string | null };
export const formCircleFromEvent: typeof F.formCircleFromEvent = async (eventId, name) =>
    await session.eventCommand({ action: 'form_circle', id: eventId, name }) as { communityId: string; name: string; members: number; gathered: boolean };
export const formCommunityFromCircle: typeof F.formCommunityFromCircle = async (communityId, name) =>
    await session.communityCommand({ action: 'form_circle', id: communityId, name }) as { communityId: string; name: string; bornOn: string | null };
// THE ANCHOR'S PROOF AND THE DOORS (ring 2026-11-02, /v1/domains/command, migration 054): the node
// mints the single-use token, observes the TXT record itself and writes the server-only mark; a door
// is claimed by the same proof, or granted by the steward when it is one of this node's face doors.
const domains = (command: Record<string, unknown>) => session.domainCommand(command);
export const startDomainVerification: typeof F.startDomainVerification = async (communityId) =>
    await domains({ action: 'start_verification', communityId }) as F.DomainChallengeRecord;
export const checkDomainVerification: typeof F.checkDomainVerification = async (communityId) =>
    await domains({ action: 'check_verification', communityId }) as { verified: boolean; domain: string };
export const startDoorClaim: typeof F.startDoorClaim = async (communityId, door) =>
    await domains({ action: 'start_door', communityId, door }) as F.DoorClaim;
export const checkDoorClaim: typeof F.checkDoorClaim = async (communityId, door) =>
    await domains({ action: 'check_door', communityId, door }) as { claimed: boolean; door: string; moved: number };
export const grantDoor: typeof F.grantDoor = async (communityId, door) =>
    await domains({ action: 'grant_door', communityId, door }) as { claimed: boolean; door: string; moved: number };
export const withdrawDoor: typeof F.withdrawDoor = async (communityId, door) =>
    await domains({ action: 'withdraw_door', communityId, door }) as { withdrawn: boolean; door: string };
export const listDoorClaims: typeof F.listDoorClaims = async (communityId) =>
    ((await domains({ action: 'list_doors', communityId })) as { claims: F.DoorClaim[] }).claims;
void createBlock; void normalizeDomain;
