// THE INDEPENDENT NODE'S HAND for intelligence — the mirror of ../firebase/intelligence.ts (rings
// 2026-11-01/03). The commons — intelligences, personas, memories — live in documents and go
// through the door under the law (a public intelligence is everyone's to read, its author's to
// care; a memory's visibility is its own). The voice's pure half is shared (services/
// intelligenceVoice). Reaching a MODEL — and keeping a provider key — is THE AI ORGAN's (POST
// /v1/ai/command, ring 2026-11-03): the node decides whose key answers (a kept credential the hand
// may spend, else its own, gated and counted) and speaks to the provider. A key passes through
// this file once, on its way in; nothing here ever reads one back.
import type * as F from '../firebase/intelligence';
import { currentUid, session } from './core';
import { docGet, docAll, docCommand, serverTime, arrayUnion } from './docs';
import { uuidv7 } from '../../utils/id';
import { speak } from '../../utils/translations';
import config from '../../../lifeseed.config.json';
import type { Intelligence, Persona, Memory, IntelligenceMessage, IntelligenceProvider, IntelligenceProviderId, IntelligenceRef } from '../../domain/intelligence';
import { AI_DAILY_TEXT_LIMIT, providerLabel } from '../../domain/aiAccess';
import { openingOnUser, type AiTurn, type AiRailProvider, type AiCredentialScope } from '../../domain/aiRequest';
import { NODE_CLAUDE_MODEL } from '../../domain/aiPrompts';
import { composeSystemPrompt, getActiveIntelligenceId, DEFAULT_INTELLIGENCE_ID } from '../intelligenceVoice';
export { composeSystemPrompt, setActiveIntelligenceId, setActiveIntelligenceDuties, getActiveIntelligenceId, DEFAULT_INTELLIGENCE_ID } from '../intelligenceVoice';
export type { CredentialScope } from '../firebase/intelligence';

const DEFAULT_MODEL = config.model || 'gemini-3.5-flash';
const byName = <T extends { name: string }>(items: T[]) => [...items].sort((a, b) => a.name.localeCompare(b.name));

// ---------------------------------------------------------------------------
// The rail: one ask of the organ. The transcript, the voice and the credential the intelligence
// draws on travel; the node answers with the text (or a picture) and which key spoke.
// ---------------------------------------------------------------------------
export interface ModelAsk {
  provider: AiRailProvider; model?: string; system?: string; messages: AiTurn[]; json?: boolean; image?: boolean;
  credential?: { scope: AiCredentialScope; holderId: string };
}
export interface ModelAnswer { text: string; image?: string; source: 'node' | 'byo' }
export const askModel = (ask: ModelAsk): Promise<ModelAnswer> => session.aiCommand({ action: 'generate', ...ask }) as Promise<ModelAnswer>;
// The credential an intelligence draws on, as the organ names it (the node's own key is no credential).
export const credentialOf = (ref: Pick<IntelligenceRef, 'credentialScope' | 'credentialHolderUid'>): ModelAsk['credential'] | undefined =>
  ref.credentialScope && ref.credentialScope !== 'node' && ref.credentialHolderUid ? { scope: ref.credentialScope, holderId: ref.credentialHolderUid } : undefined;

const turnsOf = (messages: IntelligenceMessage[]): AiTurn[] => openingOnUser(messages.map(m => ({ role: m.role, text: m.text })));
const railProvider = (id: AiRailProvider, fallbackModel: string): IntelligenceProvider => ({
  id,
  async sendMessage(intelligence, messages, options) {
    const turns = turnsOf(messages);
    if (turns.length === 0) return '';
    const answer = await askModel({ provider: id, model: intelligence.model || fallbackModel, system: composeSystemPrompt(options?.persona, options?.memory),
      messages: turns, credential: credentialOf(intelligence) });
    return answer.text || '';
  },
});
// A provider this node has no rail to: it answers honestly rather than crashing the chat (the origin's words, spoken).
const unconfiguredProvider = (id: IntelligenceProviderId): IntelligenceProvider => ({ id, async sendMessage() { return speak('ai_provider_unconfigured', { id }); } });
const providers: Record<IntelligenceProviderId, IntelligenceProvider> = {
  google: railProvider('google', DEFAULT_MODEL),
  anthropic: railProvider('anthropic', NODE_CLAUDE_MODEL),
  openai: unconfiguredProvider('openai'),
  deepseek: unconfiguredProvider('deepseek'),
  local: unconfiguredProvider('local'),
};

// A key is kept by the organ: sealed before it touches the soil, hinted back, never read by a request.
export const saveProviderCredential: typeof F.saveProviderCredential = (params) => session.aiCommand({
  action: 'save_credential', scope: params.scope, holderId: params.holderId, provider: params.provider, key: params.key,
  ...(params.intelligenceId ? { intelligenceId: params.intelligenceId } : {}),
}) as Promise<{ connected: boolean; keyHint?: string }>;
export const disconnectProviderCredential: typeof F.disconnectProviderCredential = (params) => saveProviderCredential({ ...params, key: '' });
export const getProvider: typeof F.getProvider = (id) => providers[id] || providers.google;
export const resolveAISource: typeof F.resolveAISource = async (opts) => {
    const id = opts?.intelligenceId ?? getActiveIntelligenceId() ?? DEFAULT_INTELLIGENCE_ID;
    const intel = id ? await getIntelligence(id).catch(() => null) : null;
    const provider = intel?.provider || 'google';
    const label = providerLabel(provider);
    const wired = intel as ({ connected?: boolean; keyHint?: string; sponsored?: string } | null);
    if (wired?.connected && intel?.credentialScope === 'user') return { source: 'user_key', allowed: true, provider, model: intel.model, keyHint: wired.keyHint, label: `${label} · your key`, detail: wired.keyHint };
    if (wired?.connected && intel?.credentialScope === 'community') return { source: 'community_key', allowed: true, provider, model: intel.model, keyHint: wired.keyHint, label: `${label} · community key`, detail: wired.keyHint };
    if (wired?.sponsored) return { source: 'sponsored', allowed: true, provider, model: intel?.model, label: `${label} · sponsored`, detail: String(wired.sponsored) };
    const left = Math.max(0, AI_DAILY_TEXT_LIMIT - (opts?.dailyTextUsed || 0));
    return { source: 'node_compute', allowed: left > 0, provider, model: intel?.model, remainingToday: left, label: `${label} · network`, detail: `${left} reflections left today` };
};
export const sendIntelligenceMessage: typeof F.sendIntelligenceMessage = (intelligence, messages, options) => getProvider(intelligence.provider).sendMessage(intelligence, messages, options);
export const getIntelligence: typeof F.getIntelligence = (id) => docGet<Intelligence>('intelligences', id);
export const getPersona: typeof F.getPersona = (id) => docGet<Persona>('personas', id);
export const listPersonas: typeof F.listPersonas = async () => byName(await docAll<Persona>('personas'));
export const getMemoriesByIds: typeof F.getMemoriesByIds = async (ids) =>
    (await Promise.all(ids.map(id => docGet<Memory>('memories', id).catch(() => null)))).filter((m): m is Memory & { id: string } => !!m);
export const createMemory: typeof F.createMemory = async (data) => {
    const born = await docCommand({ action: 'create', collection: 'memories', data: {
        lid: uuidv7(), name: data.name, text: data.text, authorId: currentUid() || '', visibility: data.visibility || 'private',
        ...(data.communityId ? { communityId: data.communityId } : {}), sourceIds: [], createdAt: serverTime(),
    } });
    return born.id;
};
export const addIntelligenceMemory: typeof F.addIntelligenceMemory = async (intelligenceId, name, text) => {
    const memoryId = await createMemory({ name, text, visibility: 'community' });
    await docCommand({ action: 'update', collection: 'intelligences', id: intelligenceId, patch: { memoryIds: arrayUnion(memoryId) } });
    return memoryId;
};
export const resolveIntelligenceMemoryText: typeof F.resolveIntelligenceMemoryText = async (intelligence) => {
    const ids = intelligence?.memoryIds;
    if (!ids || ids.length === 0) return '';
    try { return (await getMemoriesByIds(ids)).map(m => m.text).filter(Boolean).join('\n\n'); } catch { return ''; }
};
const visibleIntelligences = async (authorId?: string) => {
    const byId = new Map<string, Intelligence>();
    for (const i of await docAll<Intelligence>('intelligences', { where: { public: 'true' } })) byId.set(i.id, i);
    if (authorId) for (const i of await docAll<Intelligence>('intelligences', { where: { authorId } })) byId.set(i.id, i);
    return [...byId.values()];
};
export const getSelectableIntelligences: typeof F.getSelectableIntelligences = async (authorId) => byName((await visibleIntelligences(authorId)).filter(i => i.enabled !== false));
export const getManageableIntelligences: typeof F.getManageableIntelligences = async (authorId) => byName(await visibleIntelligences(authorId));
export const getPublicIntelligences: typeof F.getPublicIntelligences = async () => byName((await docAll<Intelligence>('intelligences', { where: { public: 'true' } })).filter(i => i.enabled !== false));
export const createIntelligence: typeof F.createIntelligence = async (data) => {
    const born = await docCommand({ action: 'create', collection: 'intelligences', data: { ...data, lid: uuidv7(), createdAt: serverTime() } as Record<string, unknown> });
    return born.id;
};
export const updateIntelligence: typeof F.updateIntelligence = async (id, data) => { await docCommand({ action: 'update', collection: 'intelligences', id, patch: { ...data } as Record<string, unknown> }); };
export const deleteIntelligence: typeof F.deleteIntelligence = async (id) => { await docCommand({ action: 'delete', collection: 'intelligences', id }); };
export const createPersona: typeof F.createPersona = async (data) => {
    const born = await docCommand({ action: 'create', collection: 'personas', data: { ...data, createdAt: serverTime() } as Record<string, unknown> });
    return born.id;
};
export const promoteToDefaultVoice: typeof F.promoteToDefaultVoice = async (intel) => {
    await updateIntelligence(DEFAULT_INTELLIGENCE_ID, { provider: intel.provider, model: intel.model, credentialScope: intel.credentialScope, credentialHolderUid: intel.credentialHolderUid,
        connected: intel.connected ?? true, keyHint: intel.keyHint, enabled: true, public: true } as Partial<Intelligence>);
    if (intel.id !== DEFAULT_INTELLIGENCE_ID) await updateIntelligence(intel.id, { public: true } as Partial<Intelligence>);
};
// The commons' starting vocabulary is seeded by the installation (seed:commons), a staff hand's work.
export const ensureIntelligenceCommons: typeof F.ensureIntelligenceCommons = async () => {};
