import React from 'react';

// A full-width tab strip that sits directly above a SectionHeader band. Every tab takes an equal
// slice of the width, so two tabs each hold half the screen. The WHOLE strip wears one pigment
// (the active tab's tone, matching the band below), so the active tab flows seamlessly into the
// band and the strip never looks split down the middle; the inactive tabs simply dim back.
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
    <div className="grid" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
        {tabs.map(tb => {
            const on = tb.key === active;
            return (
                <button
                    key={tb.key}
                    type="button"
                    onClick={() => onChange(tb.key)}
                    aria-pressed={on}
                    className={`flex items-center justify-center gap-2 px-3 py-3 text-sm font-bold tracking-wide text-white transition-opacity sm:py-3.5 ${on ? 'opacity-100' : 'opacity-45 hover:opacity-70'}`}
                    style={{ backgroundColor: tone }}
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
