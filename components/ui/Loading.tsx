import React, { useEffect, useState } from 'react';

/**
 * A subtle loader: a small row of lightseeds rising and falling in a wave. No logo —
 * quiet enough to sit anywhere without shouting.
 */
export const Loading = ({ timeoutMs = 12000 }: { timeoutMs?: number }) => {
    const [timedOut, setTimedOut] = useState(false);

    useEffect(() => {
        const timer = window.setTimeout(() => setTimedOut(true), timeoutMs);
        return () => window.clearTimeout(timer);
    }, [timeoutMs]);

    return (
        <div className="flex flex-col items-center justify-center gap-3 p-8">
            <style>{`@keyframes lightseed-wave { 0%, 100% { transform: translateY(0); opacity: .45; } 50% { transform: translateY(-7px); opacity: 1; } }`}</style>
            <div className="flex items-end gap-1.5" aria-label="Loading">
                {[0, 1, 2, 3, 4].map(i => (
                    <span
                        key={i}
                        className="h-2 w-2 rounded-full bg-amber-400"
                        style={{
                            animation: 'lightseed-wave 1.1s ease-in-out infinite',
                            animationDelay: `${i * 0.12}s`,
                            boxShadow: '0 0 6px rgba(251, 191, 36, 0.6)',
                        }}
                    />
                ))}
            </div>
            {timedOut && (
                <p className="text-[11px] font-medium uppercase tracking-widest text-slate-400">Taking longer than expected</p>
            )}
        </div>
    );
};
