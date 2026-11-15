// THE ONE LAW (2026-11-14). This module was a hand-kept MIRROR of src/domain; the functions build now
// compiles the shared domain itself (tsconfig rootDir '..'), so the server judges by the very source the
// shell and the independent node judge by. Nothing is defined here: add law to src/domain.
export { IMAGE_PRIMARY_MAX_EDGE, IMAGE_PRIMARY_QUALITY, IMAGE_VARIANT_SIZES, type ImageVariantSize, IMAGE_VARIANT_QUALITY, IMAGE_VARIANT_PREFIX, IMAGE_DERIVED_PREFIXES, isDerivedImagePath, imageVariantKeyOf, storageObjectOf, storageUrlOf, imageVariantUrlOf } from '../../src/domain/imageVariant';
