import React, { useState } from 'react';
import { Icons } from './ui/Icons';
import { SectionMenu } from './ui/SectionMenu';
import { ProfileHero, type ProfileHeroProps } from './ui/ProfileHero';
import { ProfileLayout, type ProfileLayoutProps } from './ui/ProfileLayout';

// BeingProfile — the FACE of a Being (see domain/being.ts): one anatomy for human, AI,
// community, node, tree — Indra's net, where every jewel is different yet reflects all the
// others the same way. Every profile-style screen is the same scaffold: a hero (back button,
// action slot, avatar, name + meta chips), a section menu, and the active section's body.
// Composite beings (communities, nodes) simply add Council as one more section.
//
// The shells (CommunityProfile, LightseedProfile, LifetreeDetail) keep their own state,
// derivations and handlers; they hand this component the hero config and the section list,
// each section's `render` closing over that state. The base classes are extracted verbatim
// from CommunityProfile; the props below are the seams where the other shells differ
// (avatar shape, editable title block, action row inside the hero, banners, layout variants).

/** One entry of the section menu plus the body it reveals when active. */
export interface BeingSection {
    key: string;
    label: string;
    icon?: React.ReactNode;
    /** The section body — a closure over the owning shell's state and handlers. */
    render: () => React.ReactNode;
}

/** The hero — the being's banner, avatar and name row. */
export interface BeingHero {
    /** Background image behind the hero gradient (community hero photo, tree's latest growth…). */
    imageUrl?: string;
    /** The circular avatar, passed whole so each being keeps its own shape
     *  (logo disc, photo + presence dot, growth image + validation badge). */
    avatar?: React.ReactNode;
    /** The being's name — rendered as the hero <h1>. */
    title?: React.ReactNode;
    /** Optional secondary line under the title row (e.g. a tree's short title). */
    subtitle?: React.ReactNode;
    /** Meta chips flowing on the same wrapping row as the title (counts, domain, badges…). */
    chips?: React.ReactNode;
    /** Right-aligned header actions on the back-button row (delete, switch view…). */
    actions?: React.ReactNode;
    /** Full override of the avatar/title block for shells whose header is richer
     *  (LifetreeDetail's editable name/short-title inputs). Wins over avatar/title/chips. */
    body?: React.ReactNode;
    /** Extra content below the avatar/title block, still inside the hero
     *  (LifetreeDetail's coloured action-button row). */
    footer?: React.ReactNode;
    /** Classes of the avatar + title flex row. Default = CommunityProfile's. */
    avatarRowClassName?: string;
    /** Classes of the wrapping title/chips row. Default = CommunityProfile's. */
    titleRowClassName?: string;
    /** Pass-through variants for ProfileHero (padding, overlay, banner, max-width…). */
    heroProps?: Omit<ProfileHeroProps, 'heroImageUrl' | 'children'>;
}

export interface BeingProfileProps {
    hero: BeingHero;
    /** The being's sections — the menu entries and their bodies. */
    sections: BeingSection[];
    /** Which section opens first. Defaults to the first section. */
    initialSection?: string;
    /** Controlled active section — for shells that steer it from outside
     *  (LightseedProfile jumps to Reaches on an incoming message). */
    activeSection?: string;
    onSectionChange?: (key: string) => void;
    /** Renders the back button when present. */
    onClose?: () => void;
    backLabel?: string;
    /** Content rendered under the section menu, above the active section's body
     *  (LightseedProfile's invite banners; notice modals). Lives INSIDE the layout so the
     *  overlapping menu card can never cover it. */
    banner?: React.ReactNode;
    /** Pass-through variants for ProfileLayout (overlap, max-width, card classes…). */
    layoutProps?: Omit<ProfileLayoutProps, 'menu' | 'children'>;
    /** Root wrapper classes. Default = CommunityProfile's. */
    className?: string;
}

const DEFAULT_AVATAR_ROW = 'flex flex-col sm:flex-row items-center gap-4 sm:gap-5';
const DEFAULT_TITLE_ROW = 'flex flex-wrap items-center gap-x-3 gap-y-1.5 justify-center sm:justify-start';

export const BeingProfile: React.FC<BeingProfileProps> = ({
    hero,
    sections,
    initialSection,
    activeSection,
    onSectionChange,
    onClose,
    backLabel = 'Back',
    banner,
    layoutProps,
    className = 'min-h-screen pb-20',
}) => {
    const [internalSection, setInternalSection] = useState<string>(initialSection ?? sections[0]?.key ?? '');
    const active = activeSection ?? internalSection;
    const handleSelect = (key: string) => {
        setInternalSection(key);
        onSectionChange?.(key);
    };
    const current = sections.find(s => s.key === active);

    return (
        <div className={className}>
            <ProfileHero heroImageUrl={hero.imageUrl} {...hero.heroProps}>
                {(onClose || hero.actions) && (
                    <div className="flex items-center justify-between mb-6">
                        {onClose ? (
                            <button onClick={onClose} className="flex items-center gap-2 text-white/70 hover:text-white text-sm font-medium">
                                <Icons.ArrowLeft />
                                <span>{backLabel}</span>
                            </button>
                        ) : <span />}
                        {hero.actions && <div className="flex items-center gap-2">{hero.actions}</div>}
                    </div>
                )}

                {hero.body ?? (
                    <div className={hero.avatarRowClassName ?? DEFAULT_AVATAR_ROW}>
                        {hero.avatar}
                        <div className="min-w-0 flex-1">
                            {/* Name + all meta on one wrapping row */}
                            <div className={hero.titleRowClassName ?? DEFAULT_TITLE_ROW}>
                                {/* THE ONE NAME SCALE: every being's hero name is text-2xl md:text-3xl
                                    font-light tracking-wide (the font consolidation, 2026-07-22). */}
                                <h1 className="min-w-0 break-words text-2xl font-light tracking-wide md:text-3xl">{hero.title}</h1>
                                {hero.chips}
                            </div>
                            {hero.subtitle}
                        </div>
                    </div>
                )}
                {hero.footer}
            </ProfileHero>

            {/* Body: sidebar + content. The banner rides INSIDE the layout, under the section
                menu: the layout overlaps up onto the hero (z-10, negative margin), so anything
                placed between hero and layout slides BEHIND the menu card on mobile — a pending
                guardianship invitation was hiding exactly there. */}
            <ProfileLayout
                {...layoutProps}
                menu={<SectionMenu items={sections} active={active} onSelect={handleSelect} />}
            >
                {banner}
                {current?.render()}
            </ProfileLayout>
        </div>
    );
};
