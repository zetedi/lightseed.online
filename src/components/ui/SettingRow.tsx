import React from 'react';

// A SETTING, AS A ROW — the quiet card a keeper's dial sits in: an icon disc, the setting's
// name, a line saying what it does, and then either a control at the right edge (a Switch) or a
// body underneath (an input and its Save). Extracted from the copies in the community's Vision
// tab, the profile's Appearance tab and the staff panel.
export const SettingRow = ({ icon, lead, title, note, control, className = '', children }: {
    /** An icon for the slate disc. */
    icon?: React.ReactNode;
    /** A whole leading mark in place of the disc (e.g. the Mahameru avatar). */
    lead?: React.ReactNode;
    title: React.ReactNode;
    note?: React.ReactNode;
    /** The control at the row's right edge — usually a <Switch>. */
    control?: React.ReactNode;
    /** Margin or rounding overrides on the card. */
    className?: string;
    /** The body under the note: inputs, buttons, a status line. */
    children?: React.ReactNode;
}) => (
    <div className={`flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-900/70 ${className}`}>
        {lead ?? (icon && (
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-500 dark:bg-slate-800">{icon}</span>
        ))}
        <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{title}</p>
            {note && <p className="mt-0.5 text-sm text-slate-500">{note}</p>}
            {children}
        </div>
        {control && <div className="mt-1 flex shrink-0">{control}</div>}
    </div>
);

// The hairline that sets one group of settings apart from the one above it.
export const SECTION_BREAK = 'mt-8 border-t border-slate-100 pt-6 dark:border-slate-800';
