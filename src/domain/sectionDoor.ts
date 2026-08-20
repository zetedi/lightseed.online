// SECTION DOORS (ring 2026-08-19) — the hybrid adoption shape's smallest part. A website
// that keeps its own life links INTO the living web: an "Events" menu on theohouse.org
// opens seed.theohouse.org/events straight onto that room. Each door is a plain URL —
// lighter than embed.js, nothing for the mother site to maintain but an <a>.
//
// The doors are a REGISTRY, not a pattern: only named rooms open, so the section paths
// can never shadow the other doors (/b/<lid> beings, /i/<id> invitations, /model, the
// /u/** unsubscribe rewrite) — an unknown path stays what it always was, the shell at '/'.
//
// Plain contract — guaranteed now: sectionFromPath answers ONLY for the rooms named
// here; sectionPath(tab) is its exact inverse for door-bearing tabs and null otherwise
// (tests hold the round-trip). Not guaranteed: per-being URLs inside a room (an event's
// own address stays the /b/ door), and no history stack — doors use replaceState, the
// back button leaves the app, not the tab.
export const SECTION_DOORS: Readonly<Record<string, string>> = {
  forest: 'forest',
  visions: 'visions',
  events: 'events',
  offerings: 'offerings',
  communities: 'communities',
  about: 'about',
};

// The tab a pathname names, or null. Tolerates a trailing slash; matches whole
// segments only ('/events' opens, '/eventside' does not).
export const sectionFromPath = (pathname: string): string | null => {
  const m = pathname.match(/^\/([a-z]+)\/?$/);
  // Own-property only: '/constructor' matches the pattern and its inherited value is
  // truthy — the prototype chain must never mint a door.
  return m && Object.prototype.hasOwnProperty.call(SECTION_DOORS, m[1]) ? SECTION_DOORS[m[1]] : null;
};

// The canonical path for a tab — the inverse of sectionFromPath for door-bearing tabs
// ('/events' for 'events'); null for rooms without a public door (dashboard, profile).
export const sectionPath = (tab: string): string | null =>
  Object.prototype.hasOwnProperty.call(SECTION_DOORS, tab) ? `/${tab}` : null;
