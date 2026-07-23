import React from 'react';
import { tabTint } from '../../utils/tabTheme';

// The box every list sits in — a light TINT of the density header's colour above it, so header,
// tabs and body stay one hue without the full-saturation shout. (Sub-tabs used to sit on this
// box's top edge; they moved onto the header band itself, full width: see FullWidthTabs.)
export const ListBox = ({ tone = '#059669', children, className = '' }: {
    tone?: string;
    children: React.ReactNode;
    className?: string;
}) => (
    <div className={className}>
        <div className="rounded-lg p-3 shadow-md sm:p-4" style={{ backgroundColor: tabTint(tone) }}>
            {children}
        </div>
    </div>
);
