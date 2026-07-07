import React from 'react';

// Sub-tabs inside a page — the "entity list" switcher (e.g. Visions | Alignments,
// Intelligences | Organisations), so long lists don't stack into one endless scroll.
export interface SubTab { key: string; label: string; icon?: React.ReactNode; count?: number }

export const SubTabs = ({ tabs, active, onChange, tone }: {
    tabs: SubTab[];
    active: string;
    onChange: (key: string) => void;
    tone?: string; // the page's colour — paints the active tab
}) => (
    <div className="mb-4 flex items-center gap-1.5 sm:mb-5">
        {tabs.map(tb => {
            const is = tb.key === active;
            return (
                <button
                    key={tb.key}
                    onClick={() => onChange(tb.key)}
                    aria-pressed={is}
                    className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-all ${is ? 'text-white shadow-md' : 'bg-white/70 text-slate-500 hover:bg-white hover:text-slate-800'}`}
                    style={is && tone ? { backgroundColor: tone } : undefined}
                >
                    {tb.icon}
                    <span>{tb.label}</span>
                    {typeof tb.count === 'number' && tb.count > 0 && (
                        <span className={`rounded-full px-1.5 text-[10px] ${is ? 'bg-white/25' : 'bg-slate-100 text-slate-500'}`}>{tb.count}</span>
                    )}
                </button>
            );
        })}
    </div>
);
