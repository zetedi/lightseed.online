import React from 'react';

// The full-screen overlay every detail view (tree / vision / event / community) scrolls inside.
// Module-scope so it keeps a stable identity (an inline definition remounts its subtree — and
// resets scroll — on every parent render).
export const DetailWrapper = ({ children, belowHeader = false }: { children?: React.ReactNode; belowHeader?: boolean }) => (
  // belowHeader: the overlay starts under the sticky header (h-20) so the page header
  // stays visible and usable — the community profile reads as a page, not a curtain.
  <div className={`fixed inset-x-0 bottom-0 z-40 overflow-y-auto bg-slate-900/90 backdrop-blur-sm ${belowHeader ? 'top-20' : 'top-0'}`}>
    {children}
  </div>
);
