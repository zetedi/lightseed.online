// The tokenisation flag — a node toggle (About → Vision, next to the chain seal) that turns on the
// AI-token ("Attention-Energy") economy for this node. OFF by default: while off, the token
// balance/cost UI is hidden and translation doesn't charge tokens. Mirrors the chain-lock flag
// (src/domain/chain/lock.ts) — an in-memory singleton the shell syncs from the node's community.
let _enabled = false;

export const isTokenisationEnabled = (): boolean => _enabled;

export const setTokenisationEnabled = (enabled: boolean): void => { _enabled = !!enabled; };
