// The chain-lock flag — the "big red stamp" a node flips (About → Vision) to start sealing blocks
// with the canonical, reproducible hash instead of the legacy one. OFF by default, so existing
// nodes/chains are untouched until a node deliberately locks.
//
// In-memory singleton (one node per page load). The shell syncs it from the host community's
// `chainLocked` flag on load (setChainLocked); the About → Vision "Seal the chain" stamp
// (CommunityProfile) persists that flag, and App re-syncs this from it. mintPulse reads
// isChainLocked() to choose the hashing scheme.
let _locked = false;

export const isChainLocked = (): boolean => _locked;

export const setChainLocked = (locked: boolean): void => { _locked = !!locked; };
