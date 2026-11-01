// Barrel for the Firebase service layer. The implementation is split by aggregate under
// services/firebase/ (core init + authority, accounts, media, trees, spaces, governance, pulses,
// watering, engagement); this file re-exports them all so every existing
// `../services/firebase` import keeps working unchanged. Prefer importing from the specific
// aggregate module in new code.
export * from './core';
export * from './authority';
export * from './accounts';
export * from './media';
export * from './trees';
export * from './exportBeing';
export * from './spaces';
export * from './governance';
export * from './pulses';
export * from './watering';
export * from './engagement';
export * from './covenants';
export * from './stays';
export * from './holds';
