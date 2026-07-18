import React from 'react';

// The shared banner atop every profile-style view (community, lightseed, lifetree, and — next —
// event and vision). It owns ONLY the outer shell: the slate gradient, the optional hero image +
// darkening overlay, and the centered max-width container. Each screen composes its own inner rows
// (back button / avatar / name+meta / action row) as `children`, because those genuinely differ —
// so this dedupes the skeleton without flattening the screens together.
//
// Defaults match the CommunityProfile / LightseedProfile hero. LifetreeDetail passes a softer
// always-on overlay, a dimmed image, a narrower width, its own padding, and a `banner` (the
// DANGER strip that must sit full-width above the gradient).
export interface ProfileHeroProps {
    heroImageUrl?: string;
    /** Container max-width, e.g. 'max-w-6xl' (default) or 'max-w-5xl'. */
    maxWidth?: string;
    /** Padding utilities on the hero (incl. horizontal gutter). Default 'pt-6 pb-16 px-4'. */
    padding?: string;
    /** Overlay gradient classes. Default is the strong community/lightseed overlay. */
    overlayClassName?: string;
    /** Render the overlay even without a hero image (LifetreeDetail does this). */
    alwaysOverlay?: boolean;
    /** Extra classes on the hero <img> (e.g. 'opacity-70'). */
    imageClassName?: string;
    /** Full-width content rendered ABOVE the gradient (e.g. a danger banner). */
    banner?: React.ReactNode;
    /** Inline style on the shell — e.g. a theme-colored header (overrides the slate gradient). */
    style?: React.CSSProperties;
    children: React.ReactNode;
}

const DEFAULT_OVERLAY = 'bg-gradient-to-b from-slate-900/55 via-slate-900/65 to-slate-900/85';

export const ProfileHero = ({
    heroImageUrl,
    maxWidth = 'max-w-6xl',
    padding = 'pt-6 pb-16 px-4',
    overlayClassName = DEFAULT_OVERLAY,
    alwaysOverlay = false,
    imageClassName = '',
    banner,
    style,
    children,
}: ProfileHeroProps) => (
    <>
        {banner}
        <div className={`relative overflow-hidden bg-gradient-to-b from-slate-800 to-slate-900 text-white ${padding}`} style={style}>
            {heroImageUrl && (
                <img
                    src={heroImageUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                    className={`absolute inset-0 h-full w-full object-cover ${imageClassName}`}
                />
            )}
            {(heroImageUrl || alwaysOverlay) && <div className={`absolute inset-0 ${overlayClassName}`} />}
            <div className={`relative ${maxWidth} mx-auto`}>{children}</div>
        </div>
    </>
);
