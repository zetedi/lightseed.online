import React, { useId } from 'react';

// Default artwork shown on any card that has no image yet — a calm gradient wave.
// Gradient/filter ids are namespaced per instance so multiple cards don't clash.
export const DefaultCardImage = ({ className = '' }: { className?: string }) => {
    const raw = useId().replace(/[^a-zA-Z0-9]/g, '');
    const bg = `bg-${raw}`;
    const w1 = `w1-${raw}`;
    const w2 = `w2-${raw}`;
    const glow = `glow-${raw}`;

    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 1440 600"
            preserveAspectRatio="xMidYMid slice"
            className={`h-full w-full ${className}`}
            aria-hidden="true"
        >
            <defs>
                <linearGradient id={bg} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#0f172a" />
                    <stop offset="100%" stopColor="#1e293b" />
                </linearGradient>
                <linearGradient id={w1} x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#4f46e5" />
                    <stop offset="50%" stopColor="#06b6d4" />
                    <stop offset="100%" stopColor="#3b82f6" />
                </linearGradient>
                <linearGradient id={w2} x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#c084fc" />
                    <stop offset="100%" stopColor="#6366f1" />
                </linearGradient>
                <filter id={glow} x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="15" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
            </defs>
            <rect width="1440" height="600" fill={`url(#${bg})`} />
            <path fill={`url(#${w2})`} opacity="0.3" filter={`url(#${glow})`} d="M0,160 C320,220 480,320 800,280 C1120,240 1280,120 1440,100 L1440,600 L0,600 Z" />
            <path fill={`url(#${w1})`} opacity="0.95" d="M0,220 C360,260 480,400 800,340 C1120,280 1280,180 1440,160 L1440,600 L0,600 Z" />
            <path fill="none" stroke="#ffffff" strokeWidth="2" opacity="0.4" d="M0,220 C360,260 480,400 800,340 C1120,280 1280,180 1440,160" />
        </svg>
    );
};
