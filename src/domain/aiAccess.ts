// AI allowance — the four distinct ways a member's AI call can be powered, separated cleanly so
// the UI can show "what's powering this" and a future build can enforce per-source quotas. They
// are checked in PRECEDENCE order (first match wins):
//   1. user_key       — the member's own BYO provider key (no shared limit)
//   2. community_key   — the community's BYO key (shared by its members)
//   3. sponsored       — a sponsor underwrites this intelligence
//   4. tree_tokens     — Attention-Energy earned by a tree (spent on deep translation)
//   5. node_compute    — the node's own keys (a free tier with a daily limit)
// Today these are blended across checkAndIncrementAiUsage (daily limits), aiTokenBalance (tree
// tokens), providerCredentials (BYO), and the node-key fallback. This is the single vocabulary.

export type AIAllowanceSource = 'user_key' | 'community_key' | 'sponsored' | 'tree_tokens' | 'node_compute';

export interface AIAccessState {
  source: AIAllowanceSource;
  allowed: boolean;
  provider?: string;        // 'anthropic' | 'google' | 'openai' | …
  model?: string;
  keyHint?: string;         // last-4 hint for a BYO key (never the key itself)
  remainingToday?: number;  // for node_compute, the free-tier reflections left today
  label: string;            // short human label, e.g. "Claude · your key"
  detail?: string;          // secondary line, e.g. "…aB3z" or "18 reflections left today"
}

// The node free-tier daily limits (mirror services/firebase.ts checkAndIncrementAiUsage).
export const AI_DAILY_TEXT_LIMIT = 21;
export const AI_DAILY_IMAGE_LIMIT = 3;

export const aiSourceLabels: Record<AIAllowanceSource, string> = {
  user_key: 'Your key',
  community_key: 'Community key',
  sponsored: 'Sponsored',
  tree_tokens: 'Tree tokens',
  node_compute: 'Network',
};

export const providerLabel = (provider?: string): string => {
  switch (provider) {
    case 'anthropic': return 'Claude';
    case 'google': return 'Gemini';
    case 'openai': return 'OpenAI';
    case 'deepseek': return 'DeepSeek';
    default: return 'AI';
  }
};
