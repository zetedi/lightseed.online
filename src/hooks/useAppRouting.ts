import { useState, useEffect, useMemo } from 'react';
import { sectionFromPath, sectionPath } from '../domain/sectionDoor';

// The app's routing, lifted out of App.tsx. Routing is still deliberately light: the active tab +
// forest view mode, the URL-param deep-links (?tree, ?invite), the top-level route match
// (?widget, /model) — and now the SECTION DOORS (domain/sectionDoor): /events, /forest, /visions…
// open their room on load (the hybrid adoption shape — a mother site links straight into rooms
// of its seed subdomain), and the address bar keeps naming the open room so any URL a visitor
// copies is a working door.

export type ViewMode = 'grid' | 'map';

// Top-level routes matched before the app mounts (in App(), outside the providers).
export const topLevelRoute = (): { kind: 'widget'; domain: string } | { kind: 'model' } | { kind: 'app' } => {
  const params = new URLSearchParams(window.location.search);
  if (params.get('widget') === 'true') return { kind: 'widget', domain: params.get('domain') || '' };
  // Trailing slash tolerated; the data-model diagram is a hidden, need-to-know route.
  if (window.location.pathname.replace(/\/+$/, '') === '/model') return { kind: 'model' };
  return { kind: 'app' };
};

export interface AppRouting {
  tab: string;
  setTab: (tab: string) => void;
  viewMode: ViewMode;
  setViewMode: (v: ViewMode) => void;
  inviteParam: string | undefined;
}

// In-app routing state. `onOpenTreeId` is invoked once on load if a ?tree=<id> share link is
// present, so the shell can open that tree without owning the URL read.
export const useAppRouting = (onOpenTreeId: (id: string) => void): AppRouting => {
  // Born on a section door, the app opens straight onto that room.
  const [tab, setTab] = useState(() => sectionFromPath(window.location.pathname) || 'dashboard');
  const [viewMode, setViewMode] = useState<ViewMode>('map');

  // The address stays honest: it names the open room while one is open, and returns to '/'
  // otherwise — a copied URL is always a working door, never a stale claim. replaceState
  // only (no history stack): back leaves the app, it does not unwind tabs. The being and
  // invitation doors (/b/, /i/) own their paths; a section change must not overwrite them
  // before their one-shot effects consume the address.
  useEffect(() => {
    const path = window.location.pathname;
    if (/^\/(b|i)\//.test(path)) return;
    const door = sectionPath(tab) || '/';
    if (path !== door) window.history.replaceState(window.history.state, '', door + window.location.search);
  }, [tab]);

  // An ?invite=<token> link opens the join flow with a locked email.
  const inviteParam = useMemo(() => new URLSearchParams(window.location.search).get('invite') || undefined, []);

  // A ?tree=<id> share link opens that tree's page on load.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('tree');
    if (id) onOpenTreeId(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { tab, setTab, viewMode, setViewMode, inviteParam };
};
