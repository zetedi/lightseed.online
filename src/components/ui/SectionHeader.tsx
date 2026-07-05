import React from 'react';
import { LeafTexture } from './LeafTexture';

// Shared section header — mirrors the unified header of the Threads/Inspiration
// panel (emerald gradient, icon chip, title + subtitle) so the Visions, Events
// and Pulses views share one consistent look and feel. `pattern` overlays the
// events-banner leaf texture, fading out downwards.
export const SectionHeader = ({ icon, title, subtitle, action, footer, children, pattern = false }: {
    icon: React.ReactNode;
    title: string;
    subtitle?: string;
    action?: React.ReactNode;
    footer?: React.ReactNode;
    children?: React.ReactNode;
    pattern?: boolean;
}) => (
    <div className="relative overflow-hidden mb-5 sm:mb-8 rounded-xl sm:rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 to-white px-3 py-3 sm:px-6 sm:py-5 shadow-lg">
        {pattern && <LeafTexture fade opacity={0.08} />}
        {/* On desktop the title, search and action sit on one row; they stack on mobile. */}
        <div className="relative z-10 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 shrink-0 items-center gap-2.5">
                <div className="flex h-9 w-9 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                    {icon}
                </div>
                <div className="min-w-0">
                    <h2 className="truncate text-lg sm:text-2xl font-light tracking-wide text-slate-900">{title}</h2>
                    {subtitle && <p className="text-xs sm:text-sm text-slate-500">{subtitle}</p>}
                </div>
            </div>
            {(footer || action) && (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:flex-1 lg:justify-end">
                    {footer && <div className="w-full sm:flex-1 lg:max-w-xs">{footer}</div>}
                    {action && <div className="shrink-0">{action}</div>}
                </div>
            )}
        </div>
        {children && <div className="relative z-10 mt-5 sm:mt-6">{children}</div>}
    </div>
);
