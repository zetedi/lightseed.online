// THE ONE LAW (2026-11-14). This module was a hand-kept MIRROR of src/domain; the functions build now
// compiles the shared domain itself (tsconfig rootDir '..'), so the server judges by the very source the
// shell and the independent node judge by. Nothing is defined here: add law to src/domain.
export { canonicalize } from '../../src/domain/chain/canonical';
export { sha256, createBlock } from '../../src/domain/chain/hash';
export { BLOCK_CONTENT_FIELDS, blockContent, BLOCK_HASH_VERSION, blockPreimage, computeCanonicalHash } from '../../src/domain/chain/verify';
