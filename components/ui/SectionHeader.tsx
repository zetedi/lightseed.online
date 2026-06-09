import React from 'react';

// Shared section header — mirrors the unified header of the Threads/Inspiration
// panel (emerald gradient, icon chip, title + subtitle) so the Visions, Events
// and Pulses views share one consistent look and feel.
export const SectionHeader = ({ icon, title, subtitle, action, footer }: {
    icon: React.ReactNode;
    title: string;
    subtitle?: string;
    action?: React.ReactNode;
    footer?: React.ReactNode;
}) => (
    <div className="mb-8 rounded-3xl border border-emerald-100 bg-gradient-to-r from-emerald-50 to-white px-6 py-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                    {icon}
                </div>
                <div className="min-w-0">
                    <h2 className="truncate text-2xl font-light tracking-wide text-slate-900">{title}</h2>
                    {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
                </div>
            </div>
            {action && <div className="shrink-0">{action}</div>}
        </div>
        {footer && <div className="mt-4">{footer}</div>}
    </div>
);
