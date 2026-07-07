import React from 'react';
import { tabTint } from '../../utils/tabTheme';

// The box every list sits in — a light TINT of the density header's colour above it, so header,
// tabs and body stay one hue without the full-saturation shout. Optional classic tabs sit on the
// box's top edge: the active tab wears the tint and fuses into the box; inactive tabs stand back.
export interface BoxTab { key: string; label: string; icon?: React.ReactNode; count?: number }

export const ListBox = ({ tone = '#059669', tabs, activeTab, onTab, children, className = '' }: {
    tone?: string;
    tabs?: BoxTab[];
    activeTab?: string;
    onTab?: (key: string) => void;
    children: React.ReactNode;
    className?: string;
}) => {
    const tint = tabTint(tone);
    return (
        <div className={className}>
            {tabs && tabs.length > 0 && (
                <div className="flex w-full items-end gap-1">
                    {tabs.map(tb => {
                        const is = tb.key === activeTab;
                        return (
                            <button
                                key={tb.key}
                                onClick={() => onTab?.(tb.key)}
                                aria-pressed={is}
                                className={`flex items-center gap-1.5 rounded-t-lg px-4 py-2.5 text-xs font-bold transition-all ${is ? '' : 'bg-white/60 text-slate-500 hover:bg-white hover:text-slate-800'}`}
                                style={is ? { backgroundColor: tint, color: tone } : undefined}
                            >
                                {tb.icon}
                                <span>{tb.label}</span>
                                {typeof tb.count === 'number' && tb.count > 0 && (
                                    <span className={`rounded-full px-1.5 text-[10px] ${is ? 'bg-white/70' : 'bg-slate-100 text-slate-500'}`}>{tb.count}</span>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
            <div className={`${tabs && tabs.length > 0 ? 'rounded-b-lg rounded-tr-lg' : 'rounded-lg'} p-3 shadow-md sm:p-4`} style={{ backgroundColor: tint }}>
                {children}
            </div>
        </div>
    );
};
