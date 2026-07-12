import React, { useCallback, useState } from 'react';
import type { Community, Lightseed, Pulse } from '../types';
import { EventsSection } from '../components/sections/EventsSection';
import { createCommunityEvent, fetchEventPulses } from '../services/firebase';
import { queryableLevels } from '../domain/pulseVisibility';
import { sanitizeRichText } from '../utils/sanitize';
import Logo from '../components/Logo';

// The custom landing — an organisation's own webpage on its own domain, with the seed behind
// it. Signed out it is a quiet face: name, hero, vision, one sign-in button. Signed in, a
// hamburger opens the page's menu (Home, Events, Sign out — more panels as they're needed),
// all themed from the community's Appearance settings. ONE component serves every
// organisation; what differs between them is only their data.

interface CustomLandingPageProps {
  community: Community;
  lightseed: Lightseed | null;
  onSignIn: () => void;
  onSignOut: () => void;
  onEnterSeed: () => void;
  onViewEvent?: (event: Pulse) => void;
}

type Panel = string; // 'home' | 'events' | a landing page id

export const CustomLandingPage: React.FC<CustomLandingPageProps> = ({
  community,
  lightseed,
  onSignIn,
  onSignOut,
  onEnterSeed,
  onViewEvent,
}) => {
  const theme = community.theme || {};
  const primary = theme.primary || '#0f766e';
  const accent = theme.accent || '#eab308';
  const background = theme.background || '#faf5e9';
  const heroUrl = community.heroImageUrl || '';
  const [panel, setPanel] = useState<Panel>('home');
  const [menuOpen, setMenuOpen] = useState(false);

  // Events of this PLACE = everything stamped with its domain (community-scoped events and
  // node-scope ones created while standing on the domain alike). Visibility-scoped.
  const levels = queryableLevels(
    { uid: lightseed?.uid, isStaff: false, communityIds: lightseed ? [community.id] : [] },
    { communityId: community.id },
  );
  const levelsKey = levels.join(',');
  const loadEvents = useCallback(
    () => fetchEventPulses(undefined, community.domain, levels).then(r => r.items.filter(p => p.type === 'event')),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- levels is re-derived each render; keyed by its content
    [community.domain, levelsKey],
  );
  const handleCreate = useCallback(
    (draft: Parameters<typeof createCommunityEvent>[1]) => createCommunityEvent(community, draft),
    [community],
  );

  // The vision, rendered like everywhere else on seed — plus &nbsp; flattened to real spaces
  // (the rich editor pastes them in), or the text refuses to wrap and flows out of its box.
  const visionHtml = community.vision
    ? sanitizeRichText(community.vision).replace(/&nbsp;| /g, ' ')
    : '';

  // The page's menu: Home and Events are built-in; everything else is the community's own
  // authored pages (a food menu, an About, whatever the place needs) — data, not code.
  const pages = community.landingPages || [];
  const menu: { key: Panel; label: string }[] = [
    { key: 'home', label: 'Home' },
    { key: 'events', label: 'Events' },
    ...pages.map(p => ({ key: p.id, label: p.label })),
  ];
  const activePage = pages.find(p => p.id === panel);

  return (
    <div className="relative min-h-dvh overflow-x-hidden" style={{ backgroundColor: background }}>
      {/* The organisation's hero — full screen. Mobile crops to fill; desktop shows the WHOLE
          artwork (object-contain) floating on the theme's background. */}
      <div className="fixed inset-0 z-0" style={{ backgroundColor: background }}>
        {heroUrl && <img src={heroUrl} alt={community.name} className="h-full w-full object-cover lg:object-contain" />}
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/25" />
      </div>

      <div className="relative z-10 flex min-h-dvh flex-col">
        <header className="relative flex items-center justify-between gap-3 px-5 pt-5 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            {community.logoUrl && <img src={community.logoUrl} alt="" className="h-10 w-10 rounded-full border-2 border-white/70 object-cover shadow" />}
            <h1 className="truncate text-xl font-light uppercase tracking-[0.2em] text-white sm:text-2xl" style={{ textShadow: '0 1px 8px rgba(0,0,0,0.45)' }}>{community.name}</h1>
          </div>

          {lightseed ? (
            /* Signed in: the page's menu lives behind a hamburger. */
            <button
              onClick={() => setMenuOpen(o => !o)}
              aria-label="Menu"
              aria-expanded={menuOpen}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
              style={{ backgroundColor: primary }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                {menuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
              </svg>
            </button>
          ) : (
            <button
              onClick={onSignIn}
              className="shrink-0 rounded-full px-5 py-2 text-sm font-bold text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
              style={{ backgroundColor: primary }}
            >
              Sign in
            </button>
          )}

          {menuOpen && lightseed && (
            <nav className="absolute right-5 top-16 z-30 w-44 overflow-hidden rounded-2xl bg-white/95 shadow-2xl backdrop-blur-sm sm:right-8">
              {menu.map(m => (
                <button
                  key={m.key}
                  onClick={() => { setPanel(m.key); setMenuOpen(false); }}
                  className="flex w-full items-center px-4 py-3 text-left text-sm font-semibold transition-colors hover:bg-black/5"
                  style={panel === m.key ? { color: primary } : { color: '#334155' }}
                >
                  {m.label}
                </button>
              ))}
              <button
                onClick={() => { setMenuOpen(false); onSignOut(); }}
                className="flex w-full items-center border-t border-slate-100 px-4 py-3 text-left text-sm font-semibold text-slate-400 transition-colors hover:bg-black/5 hover:text-slate-600"
              >
                Sign out
              </button>
            </nav>
          )}
        </header>

        {/* Content sits low — its foot just above the corner seed, mobile and desktop alike. */}
        <main className="flex flex-1 flex-col items-center justify-end px-4 pb-24">
          {panel === 'events' && lightseed ? (
            <div className="max-h-[70dvh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white/95 p-4 shadow-2xl backdrop-blur-sm sm:p-6">
              <EventsSection
                scope="community"
                canEdit={false}
                currentUserId={lightseed?.uid}
                currentUserName={lightseed?.displayName}
                currentUserPhoto={lightseed?.photoURL}
                onViewEvent={onViewEvent}
                loadEvents={loadEvents}
                onCreate={handleCreate}
                uploadPathPrefix={`communities/${community.id}/events`}
                fallbackAuthorName={community.name}
                placeholderColor={primary}
              />
            </div>
          ) : activePage && lightseed ? (
            /* One of the community's own pages — rich text in the white box. */
            <div className="max-h-[70dvh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white/95 p-5 shadow-2xl backdrop-blur-sm sm:p-7">
              <h2 className="mb-3 text-lg font-bold" style={{ color: primary }}>{activePage.label}</h2>
              <div
                className="prose prose-slate max-w-none break-words leading-relaxed [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-xl"
                dangerouslySetInnerHTML={{ __html: sanitizeRichText(activePage.html).replace(/&nbsp;| /g, ' ') }}
              />
            </div>
          ) : (
            visionHtml && (
              <div
                className="w-full max-w-md break-words rounded-2xl bg-black/30 px-5 py-3 text-center leading-relaxed text-white backdrop-blur-sm [&_p]:my-1"
                dangerouslySetInnerHTML={{ __html: visionHtml }}
              />
            )
          )}
        </main>
      </div>

      {/* The seed in the corner — the door into the full app. */}
      <button
        onClick={onEnterSeed}
        title="Enter the seed"
        aria-label="Enter the seed"
        className="fixed bottom-5 right-5 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-2xl transition-transform hover:scale-110 active:scale-95"
        style={{ boxShadow: `0 0 24px ${accent}88, 0 4px 16px rgba(0,0,0,0.25)` }}
      >
        <Logo width={34} height={34} />
      </button>
    </div>
  );
};
