// The hash IS chain law — it lives in the domain now (ring 2026-08-14). This module remains
// as the compatibility door for the many call sites that grew up importing it from utils.
export { sha256, createBlock } from '../domain/chain/hash';
