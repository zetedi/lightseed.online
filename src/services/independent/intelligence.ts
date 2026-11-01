// THE INDEPENDENT NODE'S HAND for intelligence — the mirror of ../firebase/intelligence.ts (rings
// 2026-11-01/02). The commons — intelligences, personas, memories — live in documents and go
// through the door under the law (a public intelligence is everyone's to read, its author's to
// care; a memory's visibility is its own). The voice's pure half is shared (services/
// intelligenceVoice). Reaching a MODEL — and holding a provider key — is the AI organ's: the node
// speaks to a provider through /v1/ai when it has grown that organ; until then those hands refuse.
import type * as F from '../firebase/intelligence';
import { unported, BackendUnported } from './unported';
import { currentUid } from './core';
import { docGet, docAll, docCommand, serverTime, arrayUnion } from './docs';
import { uuidv7 } from '../../utils/id';
import type { Intelligence, Persona, Memory, IntelligenceProvider, IntelligenceProviderId } from '../../domain/intelligence';
import { AI_DAILY_TEXT_LIMIT, providerLabel } from '../../domain/aiAccess';
import { getActiveIntelligenceId, DEFAULT_INTELLIGENCE_ID } from '../intelligenceVoice';
export { composeSystemPrompt, setActiveIntelligenceId, setActiveIntelligenceDuties, getActiveIntelligenceId, DEFAULT_INTELLIGENCE_ID } from '../intelligenceVoice';
export type { CredentialScope } from '../firebase/intelligence';

const byName = <T extends { name: string }>(items: T[]) => [...items].sort((a, b) => a.name.localeCompare(b.name));
// A provider this node has not grown a rail to: it answers honestly rather than crashing the chat.
const ungrownProvider = (id: IntelligenceProviderId): IntelligenceProvider => ({
    id,
    async sendMessage() { throw new BackendUnported('intelligence.sendMessage.' + id); },
});
export const saveProviderCredential: typeof F.saveProviderCredential = unported('intelligence.saveProviderCredential');
export const disconnectProviderCredential: typeof F.disconnectProviderCredential = unported('intelligence.disconnectProviderCredential');
export const getProvider: typeof F.getProvider = (id) => ungrownProvider(id);
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
