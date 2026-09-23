// The chain-lock flag — the "big red stamp" a node flips (About → Vision) that once chose the
// browser's hashing scheme (canonical when locked, legacy otherwise). SINCE RING 2026-09-23 the
// server births every block and seals it canonically on every node, locked or not (functions/
// blocks.sealBlock): the stamp no longer changes what is written. It stays a face on the
// community (community.chainLocked) and this in-memory mirror of it, read by the superadmin
// console; retiring the face is a later ring's decision.
//
// In-memory singleton (one node per page load). The shell syncs it from the host community's
// `chainLocked` flag on load (setChainLocked); the About → Vision "Seal the chain" stamp
// (CommunityProfile) persists that flag, and App re-syncs this from it.
let _locked = false;

export const isChainLocked = (): boolean => _locked;

export const setChainLocked = (locked: boolean): void => { _locked = !!locked; };
