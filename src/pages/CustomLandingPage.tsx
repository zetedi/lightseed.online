import React from 'react';
import type { Community, Lightseed, Pulse } from '../types';
import { CommunityEvents } from '../components/community/CommunityEvents';
import { queryableLevels } from '../domain/pulseVisibility';
import Logo from '../components/Logo';

// The custom landing — an organisation's own face on its own domain, with the seed behind it.
// Signed out: the community's full-screen hero and a single sign-in button. Signed in: the same
// hero with the community's events in a white box (the same events view as on seed). A seed
// logo in the corner opens the full app; the shell offers the way back. This is v1 of the
// "custom webpage over the seed" doorway for organisations.

interface CustomLandingPageProps {
  community: Community;
  lightseed: Lightseed | null;
  onSignIn: () => void;
  onEnterSeed: () => void;
  onViewEvent?: (event: Pulse) => void;
}

export const CustomLandingPage: React.FC<CustomLandingPageProps> = ({
  community,
  lightseed,
  onSignIn,
  onEnterSeed,
  onViewEvent,
}) => {
  const theme = community.theme || {};
  const primary = theme.primary || '#0f766e';
  const accent = theme.accent || '#eab308';
  const heroUrl = community.heroImageUrl || '';
  // Signed-out visitors only query public events on this community's domain.
  const levels = queryableLevels(
    { uid: lightseed?.uid, isStaff: false, communityIds: [] },
    { communityId: community.id },
  );

  return (
    <div className="relative min-h-dvh overflow-x-hidden" style={{ backgroundColor: theme.background || '#faf5e9' }}>
      {/* The organisation's hero — full screen, their image, their light. */}
      <div className="fixed inset-0 z-0">
        {heroUrl && <img src={heroUrl} alt={community.name} className="h-full w-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/30" />
      </div>

      <div className="relative z-10 flex min-h-dvh flex-col">
        <header className="flex items-center justify-between px-5 pt-5 sm:px-8">
          <div className="flex items-center gap-3">
            {community.logoUrl && <img src={community.logoUrl} alt="" className="h-10 w-10 rounded-full border-2 border-white/70 object-cover shadow" />}
            <h1 className="text-xl font-light tracking-[0.2em] uppercase text-white drop-shadow-lg sm:text-2xl">{community.name}</h1>
          </div>
          {!lightseed && (
            <button
              onClick={onSignIn}
              className="rounded-full px-5 py-2 text-sm font-bold text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
              style={{ backgroundColor: primary }}
            >
              Sign in
            </button>
          )}
        </header>

        <main className="flex flex-1 flex-col items-center justify-end px-4 pb-24 sm:justify-center sm:pb-16">
          {lightseed ? (
            /* Signed in: the community's events, in a white box — the same view as on seed. */
            <div className="w-full max-w-3xl rounded-3xl bg-white/95 p-4 shadow-2xl backdrop-blur-sm sm:p-6">
              <CommunityEvents
                community={community}
                canEdit={false}
                currentUserId={lightseed.uid}
                currentUserName={lightseed.displayName}
                currentUserPhoto={lightseed.photoURL}
                communityLevels={levels}
                onViewEvent={onViewEvent}
              />
            </div>
          ) : (
            <p className="max-w-md rounded-2xl bg-black/25 px-5 py-3 text-center text-sm text-white backdrop-blur-sm">
              {community.vision || 'A living place. Sign in to see what is growing.'}
            </p>
          )}
        </main>
      </div>

      {/* The seed in the corner — the door into the full app. */}
      <button
        onClick={onEnterSeed}
        title="Enter the seed"
        aria-label="Enter the seed"
        className="fixed bottom-5 right-5 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-2xl ring-2 transition-transform hover:scale-110 active:scale-95"
        style={{ borderColor: accent, boxShadow: `0 0 24px ${accent}66`, ['--tw-ring-color' as string]: accent } as React.CSSProperties}
      >
        <Logo width={34} height={34} />
      </button>
    </div>
  );
};
