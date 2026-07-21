import { useEffect, useState } from 'react';

/**
 * The app's waiting animation: a bright little sun travelling an INVISIBLE lemniscate — two
 * tangent circles ridden as an infinity. It rounds the left circle, and from the point where
 * the two touch it rounds the right one the opposite way; no track is drawn, only the light
 * travels (the border ring is gone by request, 2026-07-21). Used wherever there's no specific
 * container to scan (app load, page loads, inline waits). For a container that's updating,
 * see ResonanceScan, which runs the same sun along the container's border.
 *
 * `size` is the full width of the figure (two circles side by side; height is size / 2).
 * `compact` trims the padding for badge-sized placements (the global network indicator).
 */
export const Loading = ({ timeoutMs = 12000, label, size = 80, compact = false }: { timeoutMs?: number; label?: string; size?: number; compact?: boolean }) => {
    const [timedOut, setTimedOut] = useState(false);

    useEffect(() => {
        const timer = window.setTimeout(() => setTimedOut(true), timeoutMs);
        return () => window.clearTimeout(timer);
    }, [timeoutMs]);

    // Two circles of radius r, centres (r, r) and (3r, r), tangent at (2r, r). From the touch
    // point: up and over the LEFT circle (counterclockwise, sweep 0) back to the touch point,
    // then up and over the RIGHT circle (clockwise, sweep 1) and home. Both tangents at the
    // touch point are vertical, so the crossing is seamless — one unbroken infinity.
    const r = size / 4;
    const d = `M ${2 * r} ${r} A ${r} ${r} 0 0 0 0 ${r} A ${r} ${r} 0 0 0 ${2 * r} ${r} A ${r} ${r} 0 0 1 ${4 * r} ${r} A ${r} ${r} 0 0 1 ${2 * r} ${r} Z`;

    return (
        <div className={`flex flex-col items-center justify-center ${compact ? 'gap-1 p-2' : 'gap-4 p-8'}`} aria-label="Loading">
            <style>{`@keyframes lightseed-orbit { from { offset-distance: 0%; } to { offset-distance: 100%; } }`}</style>
            <div className="relative" style={{ width: size, height: size / 2 }}>
                <span
                    className="absolute left-0 top-0 h-3 w-3 rounded-full bg-yellow-300"
                    style={{
                        offsetPath: `path("${d}")`,
                        animation: 'lightseed-orbit 3s linear infinite',
                        boxShadow: '0 0 12px 5px rgba(253,224,71,0.95), 0 0 26px 12px rgba(250,204,21,0.5)',
                    }}
                />
            </div>
            {(label || timedOut) && (
                <p className="text-[11px] font-medium uppercase tracking-widest text-slate-400">
                    {timedOut ? 'Taking longer than expected' : label}
                </p>
            )}
        </div>
    );
};
