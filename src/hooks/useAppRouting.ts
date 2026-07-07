import { useState, useEffect, useMemo } from 'react';

// The app's routing, lifted out of App.tsx. Routing here is deliberately light: the shell has no
// per-tab URLs, so "routing" is the active tab + forest view mode plus the URL-param deep-links
// (?tree, ?invite) and the top-level route match (?widget, /model). Keeping it in one place slims
// the shell and gives routing a single home to grow (e.g. into real URL sync) later.

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
  const [tab, setTab] = useState('dashboard');
  const [viewMode, setViewMode] = useState<ViewMode>('map');

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
