import React from 'react';

// A full-width tab strip that sits directly above a SectionHeader band. Every tab takes an equal
// slice of the width, so two tabs each hold half the screen. Each tab wears a solid pigment (its
// own `tone`, or the shared strip `tone` when it has none); the active tab's tone matches the band
// below, so it flows in seamlessly. Inactive tabs get an OPAQUE dark veil (over the solid tone, so
// the page pattern can never bleed through) and slightly dimmed text, never `opacity` on the whole
// button, which would let the background show and read as a header sawn in half.
export interface FullWidthTab {
    key: string;
    label: string;
    icon?: React.ReactNode;
    count?: number;   // a small tally pill after the label (visions 12, alignments 6)
    tone?: string;    // an OWN colour for this tab; falls back to the strip tone when absent
}

export const FullWidthTabs = ({ tabs, active, onChange, tone }: {
    tabs: FullWidthTab[];
    active: string;
    onChange: (key: string) => void;
    tone: string;   // the fallback/strip tone (usually the active tab's, shared with the band)
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
                    className="relative flex items-center justify-center gap-2 px-3 py-3 text-sm font-bold tracking-wide text-white transition-colors sm:py-3.5"
                    style={{ backgroundColor: tb.tone || tone }}
                >
                    {!on && <span aria-hidden className="absolute inset-0 bg-black/25" />}
                    <span className={`relative flex items-center gap-2 ${on ? '' : 'opacity-80'}`}>
                        {tb.icon && <span className="[&>svg]:h-4 [&>svg]:w-4">{tb.icon}</span>}
                        <span>{tb.label}</span>
                        {typeof tb.count === 'number' && tb.count > 0 && (
                            <span className="rounded-full bg-white/20 px-1.5 text-[10px] tabular-nums">{tb.count}</span>
                        )}
                    </span>
                </button>
            );
        })}
    </div>
);
