// THE INDEPENDENT NODE'S HAND for pulses — the mirror of ../firebase/pulses.ts (rings 2026-11-01/02).
// Reads come through /v1/pulses (migration 039) and the document door, privacy-filtered by the node.
// Minting is the block command (migration 038): the shared chain laws judge the block, the device
// key signs it when the hand has published one (./blockMint), and a hand without a key mints
// unsigned, said plainly. Every standalone record a client births (a person's reach, a tree's
// nudge) and every overlay (seen, veto, retraction) goes through the document door under the law.
import type * as F from '../firebase/pulses';
import { session, readDoc, readAll, readPage, currentUid, toMillis } from './core';
import { docAll, docGet, docCommand, docList, arrayUnion, serverTime } from './docs';
import { createSeedBlockMint } from './blockMint';
import { announce } from '../refreshBus';
import { blockBirthOf, type ChainBearerKind } from '../../domain/chain/birth';
import { normalizePulseType } from '../../domain/pulse';
import { mergeAuthored } from '../../domain/pulseVisibility';
import { isExplicitlyValidatedTree } from '../../utils/validation';
import { buildThreadId, buildGroupThreadId, reachAudienceLabels } from '../../utils/reachPermissions';
import { uuidv7 } from '../../utils/id';
import { linksToTree } from './store';
import { myNaming } from './accounts';
import type { Lifetree, Pulse, ReachAudience } from '../../types';
import type { MintedBlock, PulsePageCursor } from '../firebase/pulses';
export type { MintedBlock, PulsePageCursor } from '../firebase/pulses';

const PULSES = '/v1/pulses';
const NON_FEED_PULSE_TYPES = new Set(['reach', 'tree_chat', 'event', 'decision', 'stay']);
const ms = (p: Pulse) => toMillis(p.createdAt);
const newestFirst = (pulses: Pulse[]) => [...pulses].sort((a, b) => ms(b) - ms(a));
const oldestFirst = (pulses: Pulse[]) => [...pulses].sort((a, b) => ms(a) - ms(b));
const pulsesWhere = (params: Record<string, string>) => readAll<Pulse>(PULSES, 'pulses', params);
const page = async (params: Record<string, string>, cursor: PulsePageCursor | undefined, size: number, keep: (p: Pulse) => boolean) => {
    const after = cursor ? String(cursor) : null;
    const result = await readPage<Pulse>(PULSES, 'pulses', { ...params, ...(after ? { after } : {}) }, size);
    return { items: result.items.filter(keep), lastDoc: (result.next ?? null) as unknown as PulsePageCursor | null, hasMore: !!result.next };
};
const isReachPulse = (p: Pulse) => p.type === 'reach' || String(p.type) === 'tree_chat';
const dedupe = (lists: Pulse[][]) => { const byId = new Map<string, Pulse>(); for (const l of lists) for (const p of l) byId.set(p.id, p); return [...byId.values()]; };

// One minter per page; a mint is prepared (judged and signed on this device) and submitted once.
const minter = createSeedBlockMint(session);
const mintOn = async (on: ChainBearerKind, id: string, data: Record<string, unknown>): Promise<MintedBlock> => {
    const block = blockBirthOf({ ...data, ...(data.type ? { type: normalizePulseType(String(data.type)) } : {}) });
    for (let attempt = 0; ; attempt++) {
        try {
            try { await minter.prepare(on, id, block); }
            catch (e) {
                // A hand with no published key mints unsigned (the server says so in the block).
                if (e instanceof Error && e.message === 'signing_key_required') return await session.blockCommand({ action: 'mint', on, id, block }) as MintedBlock;
                throw e;
            }
            return await minter.submit() as MintedBlock;
        } catch (e) {
            // The head moved under the signature: read it again and sign once more, once.
            if (attempt === 0 && e instanceof Error && e.message.includes('block_head_moved')) continue;
            throw e;
        }
    }
};

export const retractReachMessage: typeof F.retractReachMessage = async (pulseId) => {
    await docCommand({ action: 'update', collection: 'pulses', id: pulseId, patch: { retractedAt: serverTime(), updatedAt: serverTime() } });
};
export const vetoGrowthPulse: typeof F.vetoGrowthPulse = async (pulseId, uid) => {
    await docCommand({ action: 'update', collection: 'pulses', id: pulseId, patch: { vetoes: arrayUnion(uid), updatedAt: serverTime() } });
};
export const mendPulseDomain: typeof F.mendPulseDomain = async (pulseId, domain) => {
    await docCommand({ action: 'update', collection: 'pulses', id: pulseId, patch: { domain, updatedAt: serverTime() } });
};
export const getMyHeadBlock: typeof F.getMyHeadBlock = async (treeId, latestHash, uid) => {
    if (!latestHash || !uid) return null;
    return (await docList<Pulse>('pulses', { where: { authorId: uid, lifetreeId: treeId, hash: latestHash }, limit: 1 })).items[0] ?? null;
};
// THE UNMINT (ring 2026-11-02): the head taken back by the node's hand under domain/unmint — the chain
// shortened by its newest link and the block's touch on the tree lifted, in one transaction (054).
// The tree is then read once so every loaded copy wears what it wears now, not only the new head.
export const unmintLastPulse: typeof F.unmintLastPulse = async (pulse) => {
    const head = await session.blockCommand({ action: 'unmint', pulseId: pulse.id }) as { latestHash: string; blockHeight: number; lifted?: string[] };
    if (pulse.lifetreeId) {
        const fresh = await docGet<Lifetree>('lifetrees', pulse.lifetreeId).catch(() => null);
        announce('trees', pulse.lifetreeId, fresh
            ? { latestHash: head.latestHash, blockHeight: head.blockHeight, watering: fresh.watering, latestGrowthUrl: fresh.latestGrowthUrl, lastCaredAt: fresh.lastCaredAt }
            : head);
        // A watering taken back is said where its thanks was said: in the circle's thread.
        const uid = currentUid();
        if (pulse.care === 'watering' && fresh && uid) {
            const naming = await myNaming();
            await postGuardiansNotice(fresh, { uid, displayName: naming.name }, `💧 ${naming.name || 'A guardian'} took back the watering.`);
        }
    }
    return { latestHash: head.latestHash, blockHeight: head.blockHeight };
};
// THE TREE'S OWN NOTICE TO ITS CIRCLE: a nudge rooted in WATER_NOTICE, never a chain block.
export const postGuardiansNotice: typeof F.postGuardiansNotice = async (tree, sender, text) => {
    try {
        if (!tree.anchorUid) return false;
        const circle = await resolveCircleUids(tree, 'guardians');
        if (circle.filter(u => u !== sender.uid).length === 0) return false;
        const participantUids = Array.from(new Set([sender.uid, ...circle].filter(Boolean)));
        await docCommand({ action: 'create', collection: 'pulses', data: {
            lid: uuidv7(), lifetreeId: tree.id, type: 'reach', visibility: 'private',
            title: `Reach: ${tree.name} -> ${tree.name} (Guardians)`, body: text, content: text,
            reachTreeId: tree.id, reachTreeName: tree.name, recipientName: tree.name, recipientUid: null, participantUids,
            threadId: buildGroupThreadId(tree.id, 'guardians', tree.anchorUid), threadName: `${tree.name} · Guardians`,
            audience: 'guardians', isGroup: true, seenBy: [], authorId: sender.uid, authorName: tree.name,
            ...(tree.imageUrl ? { authorPhoto: tree.imageUrl } : {}), domain: tree.domain || '', loveCount: 0, commentCount: 0,
            previousHash: 'WATER_NOTICE', hash: uuidv7(), createdAt: serverTime(),
        } });
        announce('reaches', tree.id);
        return true;
    } catch (e) { console.warn('The circle could not hear the notice', e); return false; }
};
export const getMyPulseCount: typeof F.getMyPulseCount = async (uid) => (await getMyPulses(uid)).length;
export const fetchPulses: typeof F.fetchPulses = async (lastD, domainFilter) =>
    page(domainFilter ? { domain: domainFilter.replace(/^www\./, '') } : {}, lastD, 24, p => !NON_FEED_PULSE_TYPES.has(String(p.type)));
export const getMyEvents: typeof F.getMyEvents = async (uid) => newestFirst(await pulsesWhere({ author: uid, type: 'event' }));
export const fetchEventPulses: typeof F.fetchEventPulses = async (lastD, domainFilter, _levels, anchorUid) => {
    const res = await page({ type: 'event', ...(domainFilter ? { domain: domainFilter.replace(/^www\./, '') } : {}) }, lastD, 24, p => p.type === 'event');
    const mine = (anchorUid && !lastD) ? await getMyEvents(anchorUid).catch(() => [] as Pulse[]) : [];
    return { items: mergeAuthored(res.items, mine, p => ms(p)), lastDoc: res.lastDoc };
};
export const fetchOfferingPulses: typeof F.fetchOfferingPulses = async (lastD, domainFilter) =>
    page({ type: 'offering', ...(domainFilter ? { domain: domainFilter.replace(/^www\./, '') } : {}) }, lastD, 24, p => p.type === 'offering');
export const fetchReachPulses: typeof F.fetchReachPulses = async (lastD, domainFilter) =>
    page(domainFilter ? { domain: domainFilter.replace(/^www\./, '') } : {}, lastD, 24,
        p => isReachPulse(p) && (p.visibility || 'public') === 'public' && !p.participantUids && !p.recipientUid);
// My 1:1 conversation with a partner tree's owner: what I sent it, what it sent me, the legacy chat.
export const fetchReachThread: typeof F.fetchReachThread = async (partnerId, viewer) => {
    const myUid = viewer.uid || undefined;
    if (!myUid) return [];
    const quiet = (p: Promise<(Pulse & { id: string })[]>) => p.catch(() => [] as Pulse[]);
    const [outgoing, incoming, legacy] = await Promise.all([
        quiet(docAll<Pulse>('pulses', { where: { authorId: myUid, reachTreeId: partnerId } })),
        quiet(docAll<Pulse>('pulses', { where: { recipientUid: myUid, lifetreeId: partnerId } })),
        quiet(docAll<Pulse>('pulses', { where: { chatTreeId: partnerId } })),
    ]);
    return oldestFirst(dedupe([outgoing, incoming, legacy]).filter(p => isReachPulse(p) && !p.isGroup));
};
export const fetchThreadById: typeof F.fetchThreadById = async (threadId, viewerUid) => {
    if (!threadId || !viewerUid) return [];
    return oldestFirst((await docAll<Pulse>('pulses', { where: { threadId }, has: { participantUids: viewerUid } })).filter(isReachPulse));
};
export const fetchMyReaches: typeof F.fetchMyReaches = async (uid) => {
    const [authored, received, partOf] = await Promise.all([
        pulsesWhere({ author: uid }), pulsesWhere({ recipient: uid }), pulsesWhere({ participant: uid }),
    ]);
    return { items: newestFirst(dedupe([authored, received, partOf]).filter(isReachPulse)), lastDoc: null };
};
// The inbox, followed: no live channel yet, so the shell re-asks every twenty seconds.
export const listenToMyReaches: typeof F.listenToMyReaches = (uid, callback) => {
    let alive = true;
    const tell = async () => {
        try { const items = (await pulsesWhere({ participant: uid })).filter(isReachPulse); if (alive) callback(items); }
        catch { /* the next ask may answer */ }
    };
    void tell();
    const timer = window.setInterval(() => { void tell(); }, 20_000);
    return () => { alive = false; window.clearInterval(timer); };
};
export const markReachesSeen: typeof F.markReachesSeen = async (pulseIds, uid) => {
    await Promise.all(pulseIds.map(id => docCommand({ action: 'update', collection: 'pulses', id, patch: { seenBy: arrayUnion(uid) } }).catch(() => {})));
};
export const markReachPulsesSeen: typeof F.markReachPulsesSeen = markReachesSeen;
// The circle's uids from the LIN (a secret tree's seats from the secret ledger).
export const resolveCircleUids: typeof F.resolveCircleUids = async (tree, audience) => {
    const anchor = tree.anchorUid ? [tree.anchorUid] : [];
    const byRel: Record<string, string[]> = { keeper: [], guardian: [], steward: [], observer: [] };
    try { for (const x of await linksToTree(tree)) if (x.rel && x.from && byRel[x.rel]) byRel[x.rel].push(x.from); }
    catch (e) { console.warn('resolveCircleUids: link read failed', e); }
    const ids = audience === 'owners' ? [...anchor, ...byRel.keeper]
        : audience === 'guardians' ? [...anchor, ...byRel.keeper, ...byRel.guardian]
        : [...anchor, ...byRel.keeper, ...byRel.guardian, ...byRel.steward, ...byRel.observer];
    return Array.from(new Set(ids.filter(Boolean)));
};
// A reach spoken by a PERSON with no lifetree yet: the same shape, rooted in PERSON_REACH, no chain.
const addPersonReach = async (data: Partial<Pulse> & { lifetreeId: string }) => {
    const mintedAt = Date.now();
    const born = await docCommand({ action: 'create', collection: 'pulses', data: {
        lid: uuidv7(mintedAt), type: 'reach', visibility: 'private', loveCount: 0, commentCount: 0, mintedAt,
        previousHash: 'PERSON_REACH', hash: uuidv7(), domain: window.location.hostname.replace(/^www\./, ''),
        ...Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)), createdAt: serverTime(),
    } });
    return { id: born.id } as unknown as Awaited<ReturnType<typeof mintPulse>>;
};
export const sendReach: typeof F.sendReach = async ({ fromTree, toTree, text, sender, audience, mintNotice = false, isAdmin = false, isSuperAdmin = false }) => {
    let target = toTree;
    let personPartner = false;
    if (audience || !target.anchorUid) {
        const full = await getLifetreeById(toTree.id);
        if (full) target = full;
        else if (!target.anchorUid) personPartner = true;
    }
    const anchorUid = target.anchorUid || (personPartner ? target.id : null);
    const protectedTarget = target.onlyValidatedCanReach === true;
    const isSelf = !!anchorUid && anchorUid === sender.uid;
    if (protectedTarget && !isSelf && !isAdmin && !isSuperAdmin && !(fromTree && isExplicitlyValidatedTree(fromTree))) throw new Error('err_dm_validated_only');
    const fromId = fromTree?.id || sender.uid;
    const naming = await myNaming(fromTree?.name);
    const fromName = fromTree?.name || naming.name || 'A lightseed';
    const write = fromTree ? mintPulse : addPersonReach;
    const base = {
        lifetreeId: fromId, type: 'reach' as const, body: text, content: text, reachTreeId: target.id, reachTreeName: target.name,
        recipientName: target.name, seenBy: [], visibility: 'private' as const, ...(mintNotice ? { mintNotice: true } : {}),
        authorId: sender.uid, authorName: fromName, authorPersonName: naming.personName, authorPhoto: fromTree?.imageUrl || sender.photoURL || undefined,
    };
    if (audience) {
        const circle = await resolveCircleUids(target, audience as ReachAudience);
        const participantUids = Array.from(new Set([sender.uid, ...circle].filter(Boolean)));
        if (participantUids.length <= 1) throw new Error('err_circle_empty');
        return write({ ...base, title: `Reach: ${fromName} -> ${target.name} (${reachAudienceLabels[audience]})`, recipientUid: null, participantUids,
            threadId: buildGroupThreadId(target.id, audience, sender.uid), threadName: `${target.name} · ${reachAudienceLabels[audience]}`, audience, isGroup: true });
    }
    const participantUids = Array.from(new Set([sender.uid, anchorUid].filter(Boolean) as string[]));
    return write({ ...base, title: `Reach: ${fromName} -> ${target.name}`, recipientUid: anchorUid, participantUids, threadId: buildThreadId(fromId, target.id) });
};
export const sendThreadMessage: typeof F.sendThreadMessage = async ({ thread, fromTree, sender, text, mintNotice = false }) => {
    const participantUids = Array.from(new Set([sender.uid, ...(thread.participantUids || [])].filter(Boolean)));
    const isGroup = thread.isGroup ?? participantUids.length > 2;
    const naming = await myNaming(fromTree?.name);
    const fromName = fromTree?.name || naming.name || 'A lightseed';
    const write = fromTree ? mintPulse : addPersonReach;
    return write({
        lifetreeId: fromTree?.id || sender.uid, type: 'reach', title: `Reach: ${fromName} -> ${thread.threadName || thread.reachTreeName || 'thread'}`,
        body: text, content: text, reachTreeId: thread.reachTreeId, reachTreeName: thread.reachTreeName,
        recipientUid: isGroup ? null : (participantUids.find(u => u !== sender.uid) || null), recipientName: thread.reachTreeName,
        participantUids, threadId: thread.threadId, threadName: thread.threadName, audience: thread.audience, isGroup,
        ...(mintNotice ? { mintNotice: true } : {}), seenBy: [], visibility: 'private', authorId: sender.uid, authorName: fromName,
        authorPersonName: naming.personName, authorPhoto: fromTree?.imageUrl || sender.photoURL || undefined,
    });
};
export const getLifetreeById: typeof F.getLifetreeById = (id) => readDoc<Lifetree>('/v1/trees?id=' + encodeURIComponent(id), 'tree');
export const getPulseById: typeof F.getPulseById = (id) => readDoc<Pulse>(PULSES + '?id=' + encodeURIComponent(id), 'pulse');
export const getMyPulses: typeof F.getMyPulses = async (uid) => newestFirst((await pulsesWhere({ author: uid })).filter(p => !NON_FEED_PULSE_TYPES.has(String(p.type))));
export const fetchGrowthPulses: typeof F.fetchGrowthPulses = async (treeId) =>
    newestFirst(await docAll<Pulse>('pulses', { where: { lifetreeId: treeId, visibility: 'public' }, within: { type: ['tree_growth', 'GROWTH'] } }));
export const getPulsesByVisionId: typeof F.getPulsesByVisionId = async (visionId) => newestFirst(await pulsesWhere({ vision: visionId }));
export const fetchMemberEvents: typeof F.fetchMemberEvents = async (communityId) =>
    (await docAll<Pulse>('pulses', { where: { communityId, visibility: 'community' } })).filter(p => p.type === 'event');
export const getPulsesByCommunity: typeof F.getPulsesByCommunity = async (communityId) => newestFirst(await pulsesWhere({ community: communityId }));
// A tree's timeline: the node already filters by the reader's sight (circle blocks for the circle).
export const getPulsesByTreeId: typeof F.getPulsesByTreeId = async (treeId) =>
    newestFirst((await pulsesWhere({ tree: treeId })).filter(p => !['reach', 'tree_chat'].includes(String(p.type))));
export const mintPulse: typeof F.mintPulse = async (pulseData) => {
    const { lifetreeId, ...rest } = pulseData;
    const head = await mintOn('tree', lifetreeId, rest as Record<string, unknown>);
    announce('trees', lifetreeId, { latestHash: head.hash, blockHeight: head.blockHeight, ...(head.latestGrowthUrl ? { latestGrowthUrl: head.latestGrowthUrl } : {}) });
    return head;
};
export const growVision: typeof F.growVision = async (vision, data) => {
    const { authorId: _author, ...rest } = data;
    void _author; // the server names the hand from the session; the client's word is not sent
    return mintOn('vision', vision.id, { type: 'vision_growth', ...rest, ...(rest.title?.trim() ? { title: rest.title.trim() } : {}), body: rest.body || '' });
};
export const careForTree: typeof F.careForTree = async (tree) => {
    const uid = currentUid();
    await mintPulse({ lifetreeId: tree.id, type: 'tree_growth', care: true, title: 'Care', body: '', visibility: 'public', ...(uid ? { authorId: uid } : {}) });
};
export const savePulseInterpretation: typeof F.savePulseInterpretation = async (pulseId, aiInterpretation) => {
    await docCommand({ action: 'update', collection: 'pulses', id: pulseId, patch: { aiInterpretation: aiInterpretation as unknown as Record<string, unknown> } });
};
