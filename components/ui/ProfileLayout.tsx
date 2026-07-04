import React from 'react';

// The shared body of a profile-style view: a sticky section menu (sidebar on desktop, a strip on
// mobile) beside the main panel. Pairs with <ProfileHero>. The section BODIES stay per-screen —
// this only owns the two-column shell and the menu card.
//
// Defaults match CommunityProfile / LightseedProfile, whose body overlaps up onto the hero
// (`overlap`) and whose <main> is itself a white card. LifetreeDetail opts out of the overlap and
// renders a bare <main> (its sections are individually carded), via the variant props.
export interface ProfileLayoutProps {
    /** The section navigation — pass a configured <SectionMenu items active onSelect />. */
    menu: React.ReactNode;
    /** Container max-width. Default 'max-w-6xl'. */
    maxWidth?: string;
    /** Overlap the body up onto the hero (needs a hero with bottom padding). Default true. */
    overlap?: boolean;
    /** The negative-margin overlap amount when `overlap`. Default '-mt-8'. */
    overlapClassName?: string;
    /** Classes for the menu's card wrapper. */
    asideClassName?: string;
    /** Classes for <main>. Default is a white card; pass a bare wrapper for self-carded sections. */
    mainClassName?: string;
    children: React.ReactNode;
}

const DEFAULT_ASIDE = 'rounded-xl border border-slate-100 bg-white p-2.5 shadow-lg lg:sticky lg:top-24';
const DEFAULT_MAIN = 'rounded-xl border border-slate-100 bg-white p-4 sm:p-6 shadow-lg min-h-[520px]';

export const ProfileLayout = ({
    menu,
    maxWidth = 'max-w-6xl',
    overlap = true,
    overlapClassName = '-mt-8',
    asideClassName = DEFAULT_ASIDE,
    mainClassName = DEFAULT_MAIN,
    children,
}: ProfileLayoutProps) => (
    <div className={`${overlap ? `relative z-10 ${overlapClassName}` : 'py-6'} ${maxWidth} mx-auto px-4`}>
        <div className="lg:grid lg:grid-cols-[230px_1fr] lg:gap-6">
            <aside className="mb-4 lg:mb-0">
                <div className={asideClassName}>{menu}</div>
            </aside>
            <main className={mainClassName}>{children}</main>
        </div>
    </div>
);
