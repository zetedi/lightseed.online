// THE PALETTE REACHES THE PAGE (ring 2026-09-14). A theme's header, ground and text have
// always coloured the shell's FRAME; the reading text and the buttons stayed the shell's own
// slate and emerald — some 1,300 utilities painted by hand, so a keeper's ink and primary never
// reached them, and the text dial on the Appearance tab moved nothing anyone could see. The
// reach is a DIAL on the community (paletteReach), off by default: on, the shell stamps
// data-palette="reach" on <html>, and index.css remaps the slate text and the emerald family
// onto the theme's ink and primary — mixed from those two, never a second palette. Explicit,
// so no standing community changes its face until its keeper turns the dial. The ink reaches
// only by day (the night keeps its own slate); the primary reaches day and night.
//
// Plain contract — guaranteed: the dial is read from exactly one boolean; the stylesheet
// carries the remap under that one attribute (tests/paletteReach.test.ts holds it). Not
// guaranteed: that every hand-painted colour is reached (gradients, the gray family and the
// rarer opacity tints are not), nor that a keeper's ink reads on the shell's white cards —
// the dial is theirs to turn back.
export const PALETTE_REACH_ATTR = 'reach';
export const paletteReaches = (c: { paletteReach?: unknown } | null | undefined): boolean => c?.paletteReach === true;
