// Chain crystal — canonical serialization, chain verification, and the birth law.
// Since ring 2026-09-23 every block is born on the SERVER (functions/mintBlock and its twins),
// judged by ./birth.ts and sealed with the canonical, reproducible scheme here on every node;
// verifyChain proves such a chain end to end (legacy blocks, born under the browser's seal
// before the ring, verify by linkage and height only). See ./canonical.ts, ./verify.ts,
// ./birth.ts and ./lock.ts (the stamp, now a face).
export { canonicalize } from './canonical';
export {
  BLOCK_CONTENT_FIELDS, BLOCK_HASH_VERSION,
  blockContent, blockPreimage, computeCanonicalHash, canonicalRecompute, verifyChain,
  isCanonicallySealed, verifyBlockSeal,
} from './verify';
export type { ChainBlock, ChainIssue, ChainIssueCode, ChainVerifyResult } from './verify';
export { isChainLocked, setChainLocked } from './lock';
export { sha256, createBlock } from './hash';
// The birth of a block (ring 2026-09-23): the law the server applies to every new chain link.
export {
  TREE_BLOCK_TYPES, VISION_BLOCK_TYPES, BLOCK_VISIBILITIES, BLOCK_BIRTH_FIELDS,
  blockBirthOf, judgeBlockBirth, blockRecordOf, chainHeadOf, heightAfter, wateringResetOf,
  BLOCK_SIGNATURE_DOMAIN, BLOCK_SIGNATURE_VERSION, SIGNED_BLOCK_FIELDS,
  signedContentOf, blockSignaturePayload, blockSignaturePreimage, blockSignaturePayloadOf,
  isBlockSignatureClaim, judgeBlockSignature,
} from './birth';
export type {
  ChainBearerKind, ChainBearerFacts, BlockBirthFacts, BlockBirthJudgment, BlockBirthRefusal, BlockBirthField, WateringResetMs,
  BlockSignaturePayload, BlockAuthorSignature, BlockSignatureRefusal, SignerFacts, BlockSignatureClaim,
} from './birth';
