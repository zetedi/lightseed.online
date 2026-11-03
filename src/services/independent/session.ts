import {seedEventCommand} from '../../domain/seedEvent.mjs';
import {seedAlignmentCommand} from '../../domain/seedAlignment.mjs';
import {seedOfferingCommand} from '../../domain/seedOffering.mjs';
import {seedBlockCommand} from '../../domain/seedBlock.mjs';
import {seedSigningCommand} from '../../domain/seedSigning.mjs';
import {seedVisionCommand} from '../../domain/seedVision.mjs';
import { seedMediaUploadPath, seedMediaReleaseInput, SEED_MEDIA_MAX_BYTES } from '../../domain/seedMedia.mjs';
import { seedProfileInput } from '../../domain/seedProfile.mjs';
import { seedLinkCommand } from '../../domain/seedLink.mjs';
import { seedTreeInviteCommand } from '../../domain/seedTreeInvite.mjs';
import { seedTreeCommand } from '../../domain/seedTree.mjs';
import { seedInviteCommand } from '../../domain/seedInvite.mjs';
import { seedCommunityCommand } from '../../domain/seedCommunity.mjs';
import { seedSessionIdentity } from '../../domain/seedBrowser';
import { seedDocCommand } from '../../domain/seedDocs.mjs';
import { seedLightCommand, seedStaffCommand, seedAccountCommand, seedDomainCommand, seedMailCommand, seedAiCommand, seedRepairCommand } from '../../domain/seedOrgans.mjs';
import type { IssuerDoor } from '../../domain/issuerDoors';

// The issuer's own claims ride beside the token: a first sign-in may take its name from them
// (the same courtesy Firebase gave a Google name), never its identity — the API chooses the uid.
export type LoginToken = { access_token: string; expired?: boolean; profile?: { name?: string; preferred_username?: string } };
// THE ISSUER'S DOORS (ring 2026-11-03): sign-in may carry a door (domain/issuerDoors: a hint, a provider,
// a required action); registration is the realm's own door beside it; the forgotten password is the realm's too.
export interface IdentityClient {
  current(): Promise<LoginToken | null>;
  callback(url: string): Promise<LoginToken>;
  login(door?: IssuerDoor): Promise<void>;
  register(door?: IssuerDoor): Promise<void>;
  reset(): Promise<void>;
  logout(): Promise<void>;
  clear(): Promise<void>;
  changes(callback: (user: LoginToken | null) => void): () => void;
}
export type SeedSession = { status: 'loading' | 'anonymous' | 'error' } | { status: 'authenticated'; uid: string; name?: string };

// The API, not an ID-token claim or email match, chooses the local UID.
export function createSeedSession(identity: IdentityClient, fetcher: typeof fetch = fetch) {
  let snapshot: SeedSession = { status: 'loading' };
  let accessToken: string | null = null;
  let generation = 0;
  let acceptChanges = true;
  let starting: Promise<void> | undefined;
  const listeners = new Set<() => void>();
  const publish = (value: SeedSession) => { snapshot = value; for (const notify of listeners) notify(); };
  const call = (path: string, token: string, input?: object, timeoutMs = 15000) => {
    if (!/^\/v1\/[a-z0-9/-]+(?:\?[^#]*)?$/.test(path) || path.includes('..')) throw new Error('invalid_api_path');
    return fetcher(path, { method: input ? 'POST' : 'GET', body: input ? JSON.stringify(input) : undefined,
      headers: { Authorization: 'Bearer ' + token, ...(input ? { 'Content-Type': 'application/json' } : {}) }, credentials: 'omit',
      redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(timeoutMs) });
  };
  const bind = async (user: LoginToken | null) => {
    const mine = ++generation;
    accessToken = null;
    if (!user || user.expired || !user.access_token) { publish({ status: 'anonymous' }); return; }
    publish({ status: 'loading' });
    try {
      const result = await call('/v1/me', user.access_token);
      if (!result.ok) throw new Error('identity_refused');
      const uid = seedSessionIdentity(await result.json());
      if (!uid) throw new Error('invalid_identity');
      if (mine !== generation) return;
      accessToken = user.access_token;
      const claimed = [user.profile?.name, user.profile?.preferred_username].find(v => typeof v === 'string' && v.trim());
      publish({ status: 'authenticated', uid, ...(claimed ? { name: claimed.trim() } : {}) });
    } catch {
      if (mine === generation) publish({ status: 'error' });
    }
  };
  identity.changes(user => { if (acceptChanges) void bind(user); });
  async function request(path: string, input?: object, image?: { path: string; bytes: Blob }, options?: { missing?: boolean; timeoutMs?: number }) {
    const token = accessToken, mine = generation;
    if (!token) throw new Error('authentication_required');
    const result = image ? await fetcher('/v1/media/upload', {
      method: 'POST', body: image.bytes,
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': image.bytes.type, 'X-Lightseed-Media-Path': image.path },
      credentials: 'omit', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(60000),
    }) : await call(path, token, input, options?.timeoutMs);
    if (mine !== generation) throw new Error('session_changed');
    if (result.status === 401) {
      ++generation; accessToken = null; publish({ status: 'anonymous' });
      throw new Error('authentication_required');
    }
    // A door that may honestly stand empty: the caller asked for null on 404 (a being by id).
    if (options?.missing && result.status === 404) return null;
    if (!result.ok) {
      // The node's refusal names itself (forbidden, doc_changed, node_full …); the shell speaks that word.
      const said = await result.json().catch(() => null) as { error?: unknown } | null;
      throw new Error(typeof said?.error === 'string' && /^[a-z_]{1,64}$/.test(said.error) ? said.error : 'api_unavailable');
    }
    const body: unknown = await result.json();
    if (mine !== generation) throw new Error('session_changed');
    return body;
  }
  return {
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    snapshot: () => snapshot,
    start(callbackUrl?: string) {
      // React StrictMode/remount must never redeem a single-use authorization code twice.
      return starting ??= (async () => {
        const mine = generation;
        try {
          const user = callbackUrl ? await identity.callback(callbackUrl) : await identity.current();
          // A logout or a newer provider event takes precedence over slow initialization.
          if (mine === generation) await bind(user);
        } catch { if (mine === generation) publish({ status: 'error' }); }
      })();
    },
    async login(door?: IssuerDoor) {
      const mine = ++generation; acceptChanges = false; accessToken = null; publish({ status: 'loading' });
      try { await identity.login(door); } catch { if (mine === generation) publish({ status: 'error' }); }
    },
    async logout() {
      const mine = ++generation; acceptChanges = false; accessToken = null; publish({ status: 'anonymous' });
      try { await identity.logout(); }
      catch {
        if (mine === generation) {
          await identity.clear().catch(() => {});
          if (mine === generation) publish({ status: 'error' });
        }
      }
    },
    read: (path: string, options?: { missing?: boolean }) => request(path, undefined, undefined, options),
    eventCommand(value: unknown) {
      const command=seedEventCommand(value);
      if(!command)return Promise.reject(new Error('invalid_command'));
      return request('/v1/events/command',command);
    },
    alignmentCommand(value: unknown) {
      const command=seedAlignmentCommand(value);
      if(!command)return Promise.reject(new Error('invalid_command'));
      return request('/v1/alignments/command',command);
    },
    offeringCommand(value: unknown) {
      const command=seedOfferingCommand(value);
      if(!command)return Promise.reject(new Error('invalid_command'));
      return request('/v1/offerings/command',command);
    },
    blockCommand(value: unknown) {
      const command=seedBlockCommand(value);
      if(!command)return Promise.reject(new Error('invalid_command'));
      return request('/v1/blocks/command',command);
    },
    signingCommand(value: unknown) {
      const command=seedSigningCommand(value);
      if(!command)return Promise.reject(new Error('invalid_command'));
      return request('/v1/signing/command',command);
    },
    visionCommand(value: unknown) {
      const command=seedVisionCommand(value);
      if(!command)return Promise.reject(new Error('invalid_command'));
      return request('/v1/visions/command',command);
    },
    linkCommand(value: unknown) {
      const command=seedLinkCommand(value);
      if(!command)return Promise.reject(new Error('invalid_command'));
      return request('/v1/links/command',command);
    },
    uploadMedia(path: string, bytes: Blob) {
      if (!seedMediaUploadPath(path) || !['image/jpeg', 'image/png', 'image/webp'].includes(bytes.type)
        || bytes.size === 0 || bytes.size > SEED_MEDIA_MAX_BYTES) return Promise.reject(new Error('invalid_media'));
      return request('/v1/media/upload', undefined, { path, bytes });
    },
    // THE RELEASE OF A PICTURE (ring 2026-11-03): asked by the picture's door on this node.
    releaseMedia(url: string) {
      const input = seedMediaReleaseInput({ url });
      if (!input) return Promise.reject(new Error('invalid_media'));
      return request('/v1/media/release', input);
    },
    // THE ISSUER'S DOORS (ring 2026-11-03): the realm's registration and forgotten-password doors, by redirect.
    async register(door?: IssuerDoor) {
      const mine = ++generation; acceptChanges = false; accessToken = null; publish({ status: 'loading' });
      try { await identity.register(door); } catch { if (mine === generation) publish({ status: 'error' }); }
    },
    reset: () => identity.reset(),
    // THE LAST HANDS (ring 2026-11-03): the keeper's audits and repairs, by the origin's names.
    repairCommand(value: unknown) {
      const command=seedRepairCommand(value);
      if(!command)return Promise.reject(new Error('invalid_command'));
      return request('/v1/repairs/command',command);
    },
    treeInviteCommand(value: unknown) {
      const command=seedTreeInviteCommand(value);
      if(!command)return Promise.reject(new Error('invalid_command'));
      return request('/v1/tree-invites/command',command);
    },
    treeCommand(value: unknown) {
      const command = seedTreeCommand(value);
      if (!command) return Promise.reject(new Error('invalid_command'));
      return request('/v1/trees/command', command);
    },
    inviteCommand(value: unknown) {
      const command = seedInviteCommand(value);
      if (!command) return Promise.reject(new Error('invalid_command'));
      return request('/v1/community-invites/command', command);
    },
    communityCommand(value: unknown) {
      const command = seedCommunityCommand(value);
      if (!command) return Promise.reject(new Error('invalid_command'));
      return request('/v1/communities/command', command);
    },
    // THE DOCUMENT DOOR (ring 2026-11-02): a document write as a claim; shape-checked here, judged by the node.
    docCommand(value: unknown) {
      const command = seedDocCommand(value);
      if (!command) return Promise.reject(new Error('invalid_command'));
      return request('/v1/docs/command', command);
    },
    // THE ORGANS (ring 2026-11-02): light, staff, the account's own departure, the domain proofs and doors.
    lightCommand(value: unknown) {
      const command = seedLightCommand(value);
      if (!command) return Promise.reject(new Error('invalid_command'));
      return request('/v1/light/command', command);
    },
    staffCommand(value: unknown) {
      const command = seedStaffCommand(value);
      if (!command) return Promise.reject(new Error('invalid_command'));
      return request('/v1/staff/command', command);
    },
    accountCommand(value: unknown) {
      const command = seedAccountCommand(value);
      if (!command) return Promise.reject(new Error('invalid_command'));
      return request('/v1/account/command', command);
    },
    domainCommand(value: unknown) {
      const command = seedDomainCommand(value);
      if (!command) return Promise.reject(new Error('invalid_command'));
      return request('/v1/domains/command', command);
    },
    // THE MAIL ORGAN (ring 2026-11-03): a letter the node composes, the letter of a place, one's own letter's delivery.
    mailCommand(value: unknown) {
      const command = seedMailCommand(value);
      if (!command) return Promise.reject(new Error('invalid_command'));
      return request('/v1/mail/command', command);
    },
    // THE AI ORGAN (ring 2026-11-03): a model asked on the hand's behalf, a provider key kept. A model takes its time.
    aiCommand(value: unknown) {
      const command = seedAiCommand(value);
      if (!command) return Promise.reject(new Error('invalid_command'));
      return request('/v1/ai/command', command, undefined, { timeoutMs: 120000 });
    },
    saveProfile: (displayName: string) => request('/v1/me/profile', { displayName }),
    profilePicture(slot: 'siteLogoUrl' | 'siteHeroUrl', path: string | null) {
      const input = seedProfileInput({ action: 'set_picture', slot, path });
      if (!input) return Promise.reject(new Error('invalid_profile'));
      return request('/v1/me/profile', input);
    },
  };
}
