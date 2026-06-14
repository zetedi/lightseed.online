import type { Timestamp } from 'firebase/firestore';

// The Intelligence Commons.
//
// Lightseed does not host one AI. It hosts a network where communities choose,
// cultivate and interact with many intelligences. The model, the persona (behaviour),
// the memory (what it can recall) and the community (who it serves) are independent
// objects so that none of them is welded to the others. An intelligence is a
// participant — a facilitator, translator or steward — never an authority.

export type IntelligenceProviderId =
  | 'google'
  | 'openai'
  | 'anthropic'
  | 'deepseek'
  | 'local';

// A configured intelligence: a provider + model, dressed in a persona, with access
// to some set of memories, available to some set of communities.
export interface Intelligence {
  id: string;
  name: string;
  description?: string;
  provider: IntelligenceProviderId;
  model: string;
  enabled: boolean;
  public: boolean;
  ownerId?: string;
  communityIds?: string[];
  memoryIds?: string[];
  personaId?: string;
  // Connection status for BYO-key providers (anthropic, …). The secret key itself lives
  // only in the locked `providerCredentials` collection; these are the non-secret mirror
  // fields the UI reads to show "connected".
  connected?: boolean;
  keyHint?: string;                                  // e.g. "…aB3z"
  credentialScope?: 'user' | 'community' | 'node';   // which key this intelligence draws on
  credentialOwnerId?: string;                        // uid or communityId for that key
  createdAt: Timestamp;
}

// Behaviour only. A persona carries voice and stance, never memory.
export interface Persona {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  createdAt: Timestamp;
}

// What an intelligence is allowed to recall. Memory is durable and outlives any
// single intelligence; intelligences remain replaceable.
export type MemoryVisibility = 'private' | 'community' | 'public';

export interface Memory {
  id: string;
  name: string;
  description?: string;
  visibility: MemoryVisibility;
  communityId?: string;
  // Inline recollection — text poured directly into the memory (e.g. imported notes/journey).
  // Injected into the intelligence's calls as recollection, not instruction.
  text?: string;
  // Source documents this memory draws from: pulses, reaches, links, visions,
  // community charter, community documents, …
  sourceIds: string[];
  createdAt: Timestamp;
}

// --- Transport shapes used by the provider abstraction ---

export interface IntelligenceMessage {
  role: 'user' | 'model';
  text: string;
}

// Resolved context handed to a provider at send time. `text` is the assembled
// recollection (persona-agnostic) drawn from the intelligence's memories.
export interface MemoryContext {
  text?: string;
  sourceIds?: string[];
}

// Every provider implements the same contract. Adding Claude, DeepSeek or a local
// model later is just another implementation of this interface — no call site changes.
export type IntelligenceRef = Pick<Intelligence, 'provider' | 'model' | 'credentialScope' | 'credentialOwnerId'>;

export interface IntelligenceProvider {
  id: IntelligenceProviderId;
  sendMessage(
    intelligence: IntelligenceRef,
    messages: IntelligenceMessage[],
    options?: { persona?: Persona | null; memory?: MemoryContext | null }
  ): Promise<string>;
}
