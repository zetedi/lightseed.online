import React, { useEffect, useRef, useState } from 'react';
import { LeafTexture } from './LeafTexture';
import { Icons } from './Icons';

// The list-page header band. No title, no icon chip — the reader already knows where they are:
// the band carries the SAME colour as the active menu item above it (see utils/tabTheme.ts), so on
// desktop the menu pill and this band read as one surface, and on mobile the list's name sits in
// the top bar next to the logo (Navigation). What remains here is what you *do* with a list:
// search (left), the density switch, and the create CTA (right). `-mt-6` pulls the band up
// against the nav so the two actually touch.
//
// On mobile the search collapses to a magnifier; tapping it opens the input FULL WIDTH over the
// switch and CTA (an overlay on the band), so a phone keeps every control without cramping.
export const SectionHeader = ({ title, tone = '#059669', action, footer, toggle, children, pattern = false, collapsibleSearch = true, searchOnTablet = false, tabs }: {
    title: string;               // screen-reader name of the section (not rendered visually)
    tone?: string;               // the active menu item's colour — one pigment, two surfaces
    action?: React.ReactNode;
    footer?: React.ReactNode;    // the search box
    toggle?: React.ReactNode;    // the density switch
    children?: React.ReactNode;
    pattern?: boolean;
    collapsibleSearch?: boolean; // false when `footer` isn't a search (e.g. the observatory quote)
    searchOnTablet?: boolean;    // show the FULL search from tablet (md), not just wide (lg): for
                                 // light pages (few/no CTAs, like Offerings/Beds) that have the room
    tabs?: React.ReactNode;      // a full-width tab strip above the band (FullWidthTabs); the active
                                 // tab shares the band's tone, so the two read as one surface
}) => {
    const [searchOpen, setSearchOpen] = useState(false);
    const overlayRef = useRef<HTMLDivElement>(null);
    // Focus the input as soon as the overlay opens — the tap meant "I want to type".
    useEffect(() => {
        if (searchOpen) overlayRef.current?.querySelector('input')?.focus();
    }, [searchOpen]);

    const collapse = footer && collapsibleSearch;
    // Where the full search unfolds: tablet (md) on roomy pages, else the wide screen (lg). Both
    // literal so Tailwind emits them. The magnifier + overlay hide from the SAME breakpoint.
    const hideBp = searchOnTablet ? 'md:hidden' : 'lg:hidden';
    const showBp = searchOnTablet ? 'md:block' : 'lg:block';

    return (
        <section aria-label={title} className="-mt-6 mb-5 sm:mb-8">
            {/* The tab strip sits flush ON TOP of the band; the active tab shares the band's tone
                so the two read as one surface (no seam). The band keeps the rounded bottom. */}
            {tabs}
            <div className="relative overflow-hidden rounded-b-lg sm:rounded-b-xl px-3 py-3 sm:px-5 sm:py-3.5 shadow-lg" style={{ backgroundColor: tone }}>
                {pattern && <LeafTexture fade opacity={0.1} />}
                <h2 className="sr-only">{title}</h2>
                {/* One row: search grows, the switch and the CTA hold the right edge. */}
                <div className="relative z-10 flex items-center gap-2 sm:gap-3">
                    {footer && (
                        collapse ? (
                            <>
                                {/* The magnifier only while the search stays folded (phones, and
                                    tablets on CTA-heavy pages); it hides once the full box unfolds. */}
                                <button
                                    onClick={() => setSearchOpen(true)}
                                    title="Search" aria-label="Search"
                                    className={`flex shrink-0 items-center justify-center rounded-full bg-white/15 p-2 text-white/85 backdrop-blur-sm transition-colors hover:bg-white/25 hover:text-white ${hideBp}`}
                                >
                                    <Icons.Search />
                                </button>
                                <span className={`flex-1 ${hideBp}`} />
                                {/* The full search box, once there's room (md on roomy pages, else lg). */}
                                <div className={`hidden min-w-0 flex-1 ${showBp}`}>{footer}</div>
                            </>
                        ) : (
                            <div className="min-w-0 flex-1">{footer}</div>
                        )
                    )}
                    {!footer && <span className="flex-1" />}
                    {toggle}
                    {action && <div className="min-w-0 shrink">{action}</div>}
                </div>
                {/* The folded-search overlay: full width, over the switch and CTA (same breakpoint). */}
                {collapse && searchOpen && (
                    <div ref={overlayRef} className={`absolute inset-0 z-20 flex items-center gap-2 px-3 ${hideBp}`} style={{ backgroundColor: tone }}>
                        <div className="min-w-0 flex-1">{footer}</div>
                        <button
                            onClick={() => setSearchOpen(false)}
                            title="Close search" aria-label="Close search"
                            className="flex shrink-0 items-center justify-center rounded-full bg-white/15 p-2 text-white/85 transition-colors hover:bg-white/25 hover:text-white"
                        >
                            <Icons.Close />
                        </button>
                    </div>
                )}
            </div>
            {children && <div className="mt-5 sm:mt-6">{children}</div>}
        </section>
    );
};
