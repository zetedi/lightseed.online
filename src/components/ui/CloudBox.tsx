import React from 'react';
import Logo from '../Logo';

// The cloud every list rests in: a soft white layer whose edges blur away into the page (no hard
// border), with the lightseed logo faint in the middle — something underground, holding the items.
// Empty states render inside it too, so "nothing yet" still has ground under it.
export const CloudBox = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
    <div className={`relative ${className}`}>
        {/* The cloud itself — bleeds past the content and blurs at the edges. */}
        <div aria-hidden className="absolute -inset-2 sm:-inset-3 rounded-[2rem] bg-white/75 blur-lg" />
        {/* The underground — the logo resting beneath the items. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
            <Logo width={260} height={260} className="opacity-[0.05] text-slate-900" />
        </div>
        <div className="relative p-2 sm:p-3">{children}</div>
    </div>
);
