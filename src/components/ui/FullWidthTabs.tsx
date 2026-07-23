import React from 'react';

// A full-width tab strip that sits directly above a SectionHeader band. Every tab takes an equal
// slice of the width, so two tabs each hold half the screen. The CONTAINER carries the one solid
// pigment (the active tab's tone, matching the band below); the buttons never carry opacity, so
// the strip can never go translucent and let the page pattern bleed through (the first cut
// dimmed the whole inactive button and it read as a header sawn in half). Inactive tabs wear a
// subtle dark overlay and dimmed text; the active tab is pure tone and flows into the band.
export interface FullWidthTab {
    key: string;
    label: string;
    icon?: React.ReactNode;
    count?: number;   // a small tally pill after the label (visions 12, alignments 6)
}

export const FullWidthTabs = ({ tabs, active, onChange, tone }: {
    tabs: FullWidthTab[];
    active: string;
    onChange: (key: string) => void;
    tone: string;   // one colour for the whole strip: the active tab's tone, shared with the band
}) => (
    <div className="grid" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))`, backgroundColor: tone }}>
        {tabs.map(tb => {
            const on = tb.key === active;
            return (
                <button
                    key={tb.key}
                    type="button"
                    onClick={() => onChange(tb.key)}
                    aria-pressed={on}
                    className={`flex items-center justify-center gap-2 px-3 py-3 text-sm font-bold tracking-wide transition-colors sm:py-3.5 ${on ? 'text-white' : 'bg-black/15 text-white/60 hover:bg-black/10 hover:text-white/85'}`}
                >
                    {tb.icon && <span className="[&>svg]:h-4 [&>svg]:w-4">{tb.icon}</span>}
                    <span>{tb.label}</span>
                    {typeof tb.count === 'number' && tb.count > 0 && (
                        <span className="rounded-full bg-white/20 px-1.5 text-[10px] tabular-nums">{tb.count}</span>
                    )}
                </button>
            );
        })}
    </div>
);
