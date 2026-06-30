// Crystal prerequisites — canonical serialization + chain verification (pure, additive).
// Nothing here is wired into live minting yet; this is what the future "lock the blocks in"
// switch turns on. See ./canonical.ts and ./verify.ts.
export { canonicalize } from './canonical';
export {
  BLOCK_CONTENT_FIELDS, BLOCK_HASH_VERSION,
  blockContent, blockPreimage, computeCanonicalHash, canonicalRecompute, verifyChain,
} from './verify';
export type { ChainBlock, ChainIssue, ChainIssueCode, ChainVerifyResult } from './verify';
