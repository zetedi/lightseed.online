import React from 'react';
import { LeafTexture } from './LeafTexture';

// The list-page header band. No title, no icon chip — the reader already knows where they are:
// the band carries the SAME colour as the active menu item above it (see utils/tabTheme.ts), so on
// desktop the menu pill and this band read as one surface, and on mobile the list's name sits in
// the top bar next to the logo (Navigation). What remains here is what you *do* with a list:
// search (left), the density switch, and the create CTA (right). `-mt-6` pulls the band up
// against the nav so the two actually touch. The list itself renders below, on the open page.
export const SectionHeader = ({ title, tone = '#059669', action, footer, toggle, children, pattern = false }: {
    title: string;               // screen-reader name of the section (not rendered visually)
    tone?: string;               // the active menu item's colour — one pigment, two surfaces
    action?: React.ReactNode;
    footer?: React.ReactNode;    // the search box
    toggle?: React.ReactNode;    // the density switch
    children?: React.ReactNode;
    pattern?: boolean;
}) => (
    <section aria-label={title} className="-mt-6 mb-5 sm:mb-8">
        <div className="relative overflow-hidden rounded-b-lg sm:rounded-b-xl px-3 py-3 sm:px-5 sm:py-3.5 shadow-lg" style={{ backgroundColor: tone }}>
            {pattern && <LeafTexture fade opacity={0.1} />}
            <h2 className="sr-only">{title}</h2>
            {/* One row: search grows, the switch and the CTA hold the right edge. */}
            <div className="relative z-10 flex items-center gap-2 sm:gap-3">
                {footer && <div className="min-w-0 flex-1">{footer}</div>}
                {toggle}
                {action && <div className="shrink-0">{action}</div>}
            </div>
        </div>
        {children && <div className="mt-5 sm:mt-6">{children}</div>}
    </section>
);
