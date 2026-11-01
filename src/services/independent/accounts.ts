// THE INDEPENDENT NODE'S HAND for accounts — the mirror of ../firebase/accounts.ts (rings
// 2026-11-01/02). Signing in is the issuer's (core.ts signInWithIssuer); the node's own profile
// (/v1/me/profile) names the hand; everything else a Firebase account did through documents
// goes through the document door (./docs) under the same law firestore.rules kept. What still
// needs an organ this node has not grown — mail, the account's own deletion, the staff roster's
// cascade — refuses by name (unported) and never reaches for the origin node.
import type * as F from '../firebase/accounts';
import { unported, unportedListener } from './unported';
import { session, currentUid, requireUid, toMillis } from './core';
import { docGet, docList, docAll, docCommand, serverTime } from './docs';
import { publicNameOf } from '../../domain/publicName';
import { excludeBedTrees } from '../../domain/bed';
import { subscriptionIdOf, isSubscriberEmail, normalizeSubscriberEmail, normalizePlaceDomain } from '../../domain/newsletter';
import { charter } from '../../config/charter';
import type { Lifetree, Pulse, Vision } from '../../types';
import { getCommunityByDomain } from './spaces';
export type { PersonPresence, InviteRow, InvitePageCursor, AdminUserRow } from '../firebase/accounts';

type Profile = { uid: string; lid: string; displayName: string; siteLogoUrl?: string; siteHeroUrl?: string };
type UserDoc = Record<string, unknown> & { id: string };
const myProfile = () => session.read('/v1/me/profile').then(b => (b as { profile: Profile | null }).profile).catch(() => null);
const mediaPathOf = (value: unknown): string | null => {
    if (typeof value !== 'string' || !value) return null;
    try { return new URL(value, window.location.origin).searchParams.get('path'); } catch { return null; }
};
const INVITE_PAGE = 12;
const asCursor = (next: unknown) => (next ?? null) as unknown as F.InvitePageCursor | null;

export const ensurePersonEntity: typeof F.ensurePersonEntity = async (uid, displayName) => {
    const profile = await myProfile();
    if (profile?.lid) return { lid: profile.lid, uid };
    // Unnamed yet: the shell asks for a name (Settings → rename); until then no portable name.
    if (!displayName?.trim()) return { lid: '', uid };
    const saved = await session.saveProfile(displayName.trim()) as { profile: Profile };
    return { lid: saved.profile.lid, uid };
};
export const getPersonPresence: typeof F.getPersonPresence = async (uid) => {
    const person = await docGet<{ displayName?: unknown; anonymous?: unknown; defaultTreeId?: unknown }>('persons', uid);
    if (!person) return null;
    return { displayName: typeof person.displayName === 'string' ? person.displayName : '', anonymous: person.anonymous === true,
        defaultTreeId: typeof person.defaultTreeId === 'string' && person.defaultTreeId ? person.defaultTreeId : undefined };
};
const ownedTreeName = async (uid: string, defaultTreeId?: string): Promise<string | null> => {
    if (defaultTreeId) {
        const tree = await docGet<Partial<Lifetree>>('lifetrees', defaultTreeId).catch(() => null);
        if (tree && tree.anchorUid === uid) return String(tree.name || '') || null;
    }
    const first = await docList<Partial<Lifetree>>('lifetrees', { where: { anchorUid: uid }, limit: 1 }).catch(() => ({ items: [] }));
    return first.items.length ? (String(first.items[0].name || '') || null) : null;
};
export const getPersonName: typeof F.getPersonName = async (uid) => {
    try {
        const presence = await getPersonPresence(uid);
        if (!presence) return undefined;
        const treeName = presence.anonymous ? await ownedTreeName(uid, presence.defaultTreeId) : null;
        return publicNameOf({ displayName: presence.displayName, anonymous: presence.anonymous, treeName }) || undefined;
    } catch { return undefined; }
};
export const myNaming: typeof F.myNaming = async (treeName) => {
    const uid = currentUid();
    if (!uid) return { name: null };
    const presence = await getPersonPresence(uid).catch(() => null);
    const anonymous = !!presence?.anonymous;
    const claimed = session.snapshot();
    const displayName = presence?.displayName || (claimed.status === 'authenticated' ? claimed.name : '') || '';
    const tree = treeName || (anonymous ? await ownedTreeName(uid, presence?.defaultTreeId).catch(() => null) : null);
    const name = publicNameOf({ displayName, anonymous, treeName: tree });
    return anonymous || !displayName ? { name } : { name, personName: displayName };
};
export const myPublicName: typeof F.myPublicName = async (treeName) => (await myNaming(treeName)).name;
export const setAnonymous: typeof F.setAnonymous = async (uid, value) => {
    await docCommand({ action: 'set', collection: 'users', id: uid, merge: true, data: { anonymous: value, updatedAt: serverTime() } });
    await docCommand({ action: 'set', collection: 'persons', id: uid, merge: true, data: { anonymous: value } });
};
// Sign-in is the issuer's door on this node (core.authCapabilities): these provider hands do not exist here.
export const signInWithGoogle: typeof F.signInWithGoogle = unported('accounts.signInWithGoogle');
export const signUpWithEmail: typeof F.signUpWithEmail = unported('accounts.signUpWithEmail');
export const signInWithEmail: typeof F.signInWithEmail = unported('accounts.signInWithEmail');
export const sendVerificationEmail: typeof F.sendVerificationEmail = unported('accounts.sendVerificationEmail');
export const resetPassword: typeof F.resetPassword = unported('accounts.resetPassword');

// --- Network onboarding invites ---------------------------------------------------------
export const createNetworkInvite: typeof F.createNetworkInvite = async (email, invitedByUserId, message = '', opts) => {
    const cleanEmail = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail)) throw new Error('err_email_invalid');
    // Already invited? (The inviter lists their own; staff list every pending one.) A duplicate costs nothing.
    const pending = await docList<{ status?: string }>('network_invites', { where: { email: cleanEmail, status: 'pending' }, limit: 1 }).catch(() => ({ items: [] }));
    const alreadyInvited = pending.items.length > 0;
    let unlimited = opts?.unlimited === true;
    if (!unlimited) {
        const [superadmin, admin] = await Promise.all([
            docGet<{ uid?: string }>('config', 'superadmin').catch(() => null), docGet('admins', invitedByUserId).catch(() => null)]);
        unlimited = superadmin?.uid === invitedByUserId || !!admin;
    }
    if (!unlimited && !alreadyInvited) {
        // Spend one of the inviter's allowance; the rule lets it only fall (never inflate).
        const me = await docGet<{ invitesRemaining?: number }>('users', invitedByUserId);
        if (!me) throw new Error('err_profile_not_found');
        const remaining = typeof me.invitesRemaining === 'number' ? me.invitesRemaining : 0;
        if (remaining <= 0) throw new Error('err_no_invites');
        await docCommand({ action: 'update', collection: 'users', id: invitedByUserId, patch: { invitesRemaining: remaining - 1 }, expect: { invitesRemaining: me.invitesRemaining ?? null } });
    }
    const normHost = window.location.hostname.replace(/^www\./, '');
    const host = await getCommunityByDomain(normHost).catch(() => null);
    const hostNode = host ? { id: host.id, domain: host.domain || normHost } : null;
    const born = await docCommand({ action: 'create', collection: 'network_invites', data: {
        email: cleanEmail, invitedByUserId, status: 'pending', message, createdAt: serverTime(),
        ...(hostNode ? { nodeCommunityId: hostNode.id, nodeDomain: hostNode.domain } : {}),
    } });
    const link = `${window.location.origin}?invite=${born.id}`;
    try {
        await triggerSystemEmail(cleanEmail, 'You are invited to lightseed',
            `${message ? `"${message}"\n\n` : ''}You have been invited to join the lightseed network.`, invitedByUserId, { ctaUrl: link, ctaLabel: 'Accept your invitation' });
    } catch (e) { console.warn('Invite email failed:', e); }
    return { id: born.id, link, alreadyInvited };
};
export const getNetworkInvite: typeof F.getNetworkInvite = async (inviteId) => docGet('network_invites', inviteId);
export const getSentInvites: typeof F.getSentInvites = async (userId, lastDoc) => {
    const page = await docList<F.InviteRow>('network_invites', { where: { invitedByUserId: userId }, newest: true, limit: INVITE_PAGE, after: (lastDoc ?? null) as unknown as [string, string] | null });
    return { items: page.items, lastDoc: asCursor(page.next), hasMore: !!page.next };
};
export const consumeNetworkInvite: typeof F.consumeNetworkInvite = async (inviteId, acceptedByUserId) => {
    await docCommand({ action: 'update', collection: 'network_invites', id: inviteId, patch: { status: 'accepted', acceptedByUserId, acceptedAt: serverTime() } });
};
// --- Invite requests ---------------------------------------------------------------------
export const createInviteRequest: typeof F.createInviteRequest = async (email, reason) => {
    const cleanEmail = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail)) throw new Error('err_email_invalid');
    await docCommand({ action: 'create', collection: 'invite_requests', data: { email: cleanEmail, reason: reason.trim(), status: 'pending', createdAt: serverTime() } });
};
export const getInviteRequests: typeof F.getInviteRequests = async (lastDoc) => {
    const page = await docList<F.InviteRow>('invite_requests', { newest: true, limit: INVITE_PAGE, after: (lastDoc ?? null) as unknown as [string, string] | null });
    return { items: page.items, lastDoc: asCursor(page.next), hasMore: !!page.next };
};
// The request is laid down; the mail that answers it and the staff-side duplicate check wait for the mail organ.
export const submitInviteRequest: typeof F.submitInviteRequest = async (email, reason) => { await createInviteRequest(email, reason); return 'created'; };
export const approveInviteRequest: typeof F.approveInviteRequest = async (requestId, adminUid) => {
    const request = await docGet<{ email?: string }>('invite_requests', requestId);
    if (!request) throw new Error('err_request_not_found');
    const invite = await createNetworkInvite(String(request.email || ''), adminUid);
    await docCommand({ action: 'update', collection: 'invite_requests', id: requestId, patch: { status: 'approved', approvedBy: adminUid, approvedAt: serverTime() } });
    return invite;
};
export const declineInviteRequest: typeof F.declineInviteRequest = async (requestId) => {
    await docCommand({ action: 'update', collection: 'invite_requests', id: requestId, patch: { status: 'declined', declinedAt: serverTime() } });
};

export const logout: typeof F.logout = () => session.logout();
// The profile, followed: the node has no live channel yet, so the shell re-asks every twenty seconds.
export const listenToUserProfile: typeof F.listenToUserProfile = (userId, callback) => {
    let alive = true;
    const tell = async () => {
        try { const user = await docGet<UserDoc>('users', userId); if (alive && user) callback(user); }
        catch { /* the next ask may answer */ }
    };
    void tell();
    const timer = window.setInterval(() => { void tell(); }, 20_000);
    return () => { alive = false; window.clearInterval(timer); };
};
export const updateUserSiteTheme: typeof F.updateUserSiteTheme = async (userId, data) => {
    await docCommand({ action: 'set', collection: 'users', id: userId, merge: true, data: { ...data, updatedAt: serverTime() } });
};
export const saveDesires: typeof F.saveDesires = async (userId, desires) => {
    await docCommand({ action: 'set', collection: 'users', id: userId, merge: true, data: { desires: { ...desires }, updatedAt: serverTime() } });
};
// Every field the users rule admits; the name moves through the profile command (persons follow),
// the two picture slots through the picture command (media paths are checked there).
export const updateUserProfile: typeof F.updateUserProfile = async (userId, data) => {
    const rest: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
        if (key === 'displayName') { await session.saveProfile(String(value)); continue; }
        if (key === 'siteLogoUrl' || key === 'siteHeroUrl') { await session.profilePicture(key, mediaPathOf(value)); continue; }
        rest[key] = value;
    }
    if (Object.keys(rest).length) await docCommand({ action: 'set', collection: 'users', id: userId, merge: true, data: { ...rest, updatedAt: serverTime() } });
};
export const setDefaultTreeOnProfile: typeof F.setDefaultTreeOnProfile = async (userId, treeId) => {
    await updateUserProfile(userId, { defaultTreeId: treeId });
    await docCommand({ action: 'set', collection: 'persons', id: userId, merge: true, data: { defaultTreeId: treeId } }).catch(() => {});
};
export const renamePerson: typeof F.renamePerson = async (name) => { await session.saveProfile(name); return name; };
// Contact privacy: the flag on the account, mirrored onto every tree the being anchors.
export const setOnlyValidatedCanReach: typeof F.setOnlyValidatedCanReach = async (userId, value) => {
    await docCommand({ action: 'set', collection: 'users', id: userId, merge: true, data: { onlyValidatedCanReach: value, updatedAt: serverTime() } });
    try {
        const mine = await docAll<Lifetree>('lifetrees', { where: { anchorUid: userId } });
        await Promise.all(mine.map(t => docCommand({ action: 'update', collection: 'lifetrees', id: t.id, patch: { onlyValidatedCanReach: value } })));
    } catch (e) { console.warn('Failed to mirror onlyValidatedCanReach onto trees', e); }
};
// THE ACCOUNT'S DEPARTURE (ring 2026-11-02): one server ceremony (/v1/account/command, migration 054) —
// the light first (the last spend, domain/light releaseRay: to the chosen heir through the prism, else
// dissolved into each ray's place), then the trees, pulses, visions and links, the profile, the login
// binding — in one transaction, so a stale login can never find a half-deleted account. Then sign out.
export const deleteUserAccount: typeof F.deleteUserAccount = async (heirUid) => {
    requireUid();
    await session.accountCommand({ action: 'delete_mine', ...(heirUid ? { heirUid } : {}) });
    await session.logout().catch(() => undefined);
};
export const checkAndIncrementAiUsage: typeof F.checkAndIncrementAiUsage = async (type) => {
    const uid = currentUid();
    if (!uid) return false;
    const user = await docGet<{ dailyAiText?: number; dailyAiImage?: number; lastAiReset?: number }>('users', uid);
    if (!user) throw new Error('err_profile_not_found');
    const now = Date.now();
    const isSameDay = new Date(user.lastAiReset || 0).toDateString() === new Date(now).toDateString();
    let textCount = user.dailyAiText || 0, imageCount = user.dailyAiImage || 0;
    if (!isSameDay) { textCount = 0; imageCount = 0; }
    if (type === 'text') { if (textCount >= 21) throw new Error('err_oracle_limit'); textCount++; }
    else { if (imageCount >= 3) throw new Error('err_vision_limit'); imageCount++; }
    await docCommand({ action: 'update', collection: 'users', id: uid, patch: { dailyAiText: textCount, dailyAiImage: imageCount, lastAiReset: now },
        expect: { dailyAiText: user.dailyAiText ?? null, dailyAiImage: user.dailyAiImage ?? null } });
    return true;
};
// Mail is an organ this node has not grown: no letter leaves here yet.
export const triggerSystemEmail: typeof F.triggerSystemEmail = unported('accounts.triggerSystemEmail');
export const sendInvite: typeof F.sendInvite = unported('accounts.sendInvite');
export const monitorMailStatus: typeof F.monitorMailStatus = unportedListener('accounts.monitorMailStatus');
// THE LETTER OF A PLACE: one row per (place, address); the footer writes it signed out, the profile signed in.
export const subscribeToNewsletter: typeof F.subscribeToNewsletter = async (email, place) => {
    if (!isSubscriberEmail(email)) throw new Error('err_email_invalid');
    const domain = normalizePlaceDomain(place);
    if (!domain) throw new Error('err_email_invalid');
    await docCommand({ action: 'set', collection: 'subscriptions', id: subscriptionIdOf(domain, email), merge: true,
        data: { email: normalizeSubscriberEmail(email), domain, active: true, createdAt: serverTime(), updatedAt: serverTime(), ...(currentUid() ? { uid: currentUid() } : {}) } });
};
export const setNewsletterSubscription: typeof F.setNewsletterSubscription = async (uid, email, subscribe, place) => {
    const domain = normalizePlaceDomain(place);
    const normalizedEmail = normalizeSubscriberEmail(email);
    await docCommand({ action: 'set', collection: 'users', id: uid, merge: true, data: { newsletterPlaces: { [domain]: subscribe }, ...(domain === charter.domain ? { newsletterSubscribed: subscribe } : {}) } });
    await docCommand({ action: 'set', collection: 'subscriptions', id: subscriptionIdOf(domain, email), merge: true,
        data: subscribe ? { uid, email: normalizedEmail, domain, active: true, updatedAt: serverTime(), createdAt: serverTime() } : { uid, email: normalizedEmail, active: false, updatedAt: serverTime() } });
    try {
        await triggerSystemEmail(email, subscribe ? 'Newsletter subscription confirmed' : 'Newsletter unsubscribed',
            subscribe ? 'You are now subscribed to the lightseed newsletter.' : 'You have been unsubscribed from the lightseed newsletter.', uid);
    } catch { /* the letter organ is not grown; the subscription stands */ }
};
const NEWSLETTER_DIGEST_SIZE = 8;
export const getNewsletterDraftData: typeof F.getNewsletterDraftData = async (place) => {
    let lastSentAt = (place?.newsletterLastSentAt as { toMillis?: () => number } | undefined) ?? null;
    if (!lastSentAt && (!place?.domain || place.domain === charter.domain)) {
        const config = await docGet<{ lastSentAt?: { toMillis?: () => number } | null }>('config', 'newsletter').catch(() => null);
        lastSentAt = config?.lastSentAt ?? null;
    }
    const since = toMillis(lastSentAt);
    const scope: Record<string, string> = place?.domain ? { domain: place.domain } : {};
    const newer = <T extends { createdAt?: unknown }>(items: T[]) => items.filter(i => !since || toMillis(i.createdAt) > since);
    const [trees, visions, pulses] = await Promise.all([
        docList<Lifetree>('lifetrees', { where: scope, newest: true, limit: NEWSLETTER_DIGEST_SIZE * 6 }).then(p => excludeBedTrees(newer(p.items)).slice(0, NEWSLETTER_DIGEST_SIZE)),
        docList<Vision>('visions', { where: scope, newest: true, limit: NEWSLETTER_DIGEST_SIZE }).then(p => newer(p.items).slice(0, NEWSLETTER_DIGEST_SIZE)),
        docList<Pulse>('pulses', { where: scope, newest: true, limit: NEWSLETTER_DIGEST_SIZE }).then(p => newer(p.items).slice(0, NEWSLETTER_DIGEST_SIZE)),
    ]);
    return { lastSentAt: lastSentAt as Awaited<ReturnType<typeof F.getNewsletterDraftData>>['lastSentAt'], trees, visions, pulses };
};
export const sendNewsletter: typeof F.sendNewsletter = unported('accounts.sendNewsletter');
export const deleteUserAsAdmin: typeof F.deleteUserAsAdmin = async (uid) =>
    await session.accountCommand({ action: 'delete_as_staff', uid }) as { deleted: boolean };
// The roster behind the staff tools: every account the staff hand may read, with the superadmin marked.
export const listUsersAsAdmin: typeof F.listUsersAsAdmin = async () => {
    requireUid();
    const [users, superadmin] = await Promise.all([docAll<UserDoc>('users'), docGet<{ uid?: string }>('config', 'superadmin').catch(() => null)]);
    return users.map(u => ({ uid: u.id, email: typeof u.email === 'string' ? u.email : null, displayName: typeof u.displayName === 'string' ? u.displayName : '',
        createdAt: toMillis(u.createdAt) || null, isSuperAdmin: superadmin?.uid === u.id }));
};
