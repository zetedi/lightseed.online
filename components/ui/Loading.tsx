
import React, { useEffect, useState } from 'react';
import Logo from '../Logo';

export const Loading = ({ timeoutMs = 12000 }: { timeoutMs?: number }) => {
    const [timedOut, setTimedOut] = useState(false);

    useEffect(() => {
        const timer = window.setTimeout(() => setTimedOut(true), timeoutMs);
        return () => window.clearTimeout(timer);
    }, [timeoutMs]);

    return (
        <div className="flex flex-col items-center justify-center p-8 gap-4">
            <div className={timedOut ? 'opacity-80' : 'animate-pulse'}>
                <Logo width={80} height={80} />
            </div>
            <p className={`font-bold text-xs uppercase tracking-widest ${timedOut ? 'text-slate-400' : 'text-slate-200 animate-pulse'}`}>
                {timedOut ? 'Taking longer than expected' : 'Loading...'}
            </p>
        </div>
    );
};
