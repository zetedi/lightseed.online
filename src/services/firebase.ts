// Barrel for the Firebase service layer. The implementation is split by aggregate under
// services/firebase/ (core init + accounts, media, trees, spaces, governance, pulses, watering,
// engagement); this file re-exports them all so every existing `../services/firebase` import keeps
// working unchanged. Prefer importing from the specific aggregate module in new code.
export * from './firebase/core';
export * from './firebase/accounts';
export * from './firebase/media';
export * from './firebase/trees';
export * from './firebase/spaces';
export * from './firebase/governance';
export * from './firebase/pulses';
export * from './firebase/watering';
export * from './firebase/engagement';
export * from './firebase/covenants';
export * from './firebase/stays';
export * from './firebase/holds';
