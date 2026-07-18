// Chain crystal — canonical serialization + chain verification.
// mintPulse now branches on isChainLocked(): a SEALED node (community.chainLocked, flipped by the
// node's About → Vision "Seal the chain" stamp) hashes new blocks with the canonical, reproducible
// scheme here; an unsealed node keeps the legacy hash. verifyChain proves a sealed chain end to end.
// See ./canonical.ts, ./verify.ts and ./lock.ts.
export { canonicalize } from './canonical';
export {
  BLOCK_CONTENT_FIELDS, BLOCK_HASH_VERSION,
  blockContent, blockPreimage, computeCanonicalHash, canonicalRecompute, verifyChain,
  isCanonicallySealed, verifyBlockSeal,
} from './verify';
export type { ChainBlock, ChainIssue, ChainIssueCode, ChainVerifyResult } from './verify';
export { isChainLocked, setChainLocked } from './lock';
