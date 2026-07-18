import { useEffect, useState } from 'react';

/**
 * The app's waiting animation: a bright yellow dot with a soft halo — a little sun — travelling
 * around a faint, logo-sized circle in the centre. Used wherever there's no specific container
 * to scan (app load, page loads, inline waits). For a container that's updating, see
 * ResonanceScan, which runs the same sun along the container's border.
 */
export const Loading = ({ timeoutMs = 12000, label, size = 60 }: { timeoutMs?: number; label?: string; size?: number }) => {
    const [timedOut, setTimedOut] = useState(false);

    useEffect(() => {
        const timer = window.setTimeout(() => setTimedOut(true), timeoutMs);
        return () => window.clearTimeout(timer);
    }, [timeoutMs]);

    const r = size / 2;
    return (
        <div className="flex flex-col items-center justify-center gap-4 p-8" aria-label="Loading">
            <style>{`@keyframes lightseed-orbit { from { offset-distance: 0%; } to { offset-distance: 100%; } }`}</style>
            <div className="relative" style={{ width: size, height: size }}>
                <div className="absolute inset-0 rounded-full ring-1 ring-amber-300/25" />
                <span
                    className="absolute left-0 top-0 h-3 w-3 rounded-full bg-yellow-300"
                    style={{
                        offsetPath: `circle(${r}px at 50% 50%)`,
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
