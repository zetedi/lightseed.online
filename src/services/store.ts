// The application's graph composition boundary: UI and service callers depend on the Store
// contract and import it here; the backend behind @backend supplies the adapter (ring
// 2026-11-01 — the seam that lets the independent node answer the same calls).
export { graphStore, linksToTree } from '@backend/store';
