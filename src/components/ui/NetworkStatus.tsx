import { useEffect, useState, useSyncExternalStore } from 'react';
import { Loading } from './Loading';
import { subscribeNet, getNetSnapshot, initNetworkWatch } from '../../services/network';

// THE NETWORK'S FACE — mounted once at the app root. Three truths, told plainly:
//   SLOW: when tracked requests stay on the wire past the grace period, the infinity loader
//         floats in (top centre, never blocking a tap) until the wire is quiet again.
//   UPLOADING: a running photo upload shows immediately, "Uploading: N%" under the loader.
//   OFFLINE: a red snackbar at the bottom for as long as the connection is gone.
// Fast requests never flash anything: the grace period keeps the app feeling instant.

const SLOW_AFTER_MS = 700;

export const NetworkStatus = () => {
    const net = useSyncExternalStore(subscribeNet, getNetSnapshot);
    useEffect(() => { initNetworkWatch(); }, []);

    // The grace period: busy must HOLD for a moment before the loader appears. Both edges run
    // on timers (the hide edge on a zero-delay tick), so the effect never sets state in-line.
    const busy = net.inFlight > 0 || net.uploadPct !== null;
    const [slow, setSlow] = useState(false);
    useEffect(() => {
        const t = window.setTimeout(() => setSlow(busy), busy ? SLOW_AFTER_MS : 0);
        return () => window.clearTimeout(t);
    }, [busy]);

    const showLoader = (slow && busy) || net.uploadPct !== null;

    return (
        <>
            {showLoader && (
                <div className="pointer-events-none fixed left-1/2 top-20 z-[90] -translate-x-1/2">
                    <div className="flex flex-col items-center rounded-2xl border border-slate-100 bg-white/95 px-4 py-1.5 shadow-lg backdrop-blur">
                        <Loading compact size={56} timeoutMs={60000} />
                        {net.uploadPct !== null && (
                            <p className="pb-1 text-[11px] font-bold text-amber-600">Uploading: {net.uploadPct}%</p>
                        )}
                    </div>
                </div>
            )}
            {!net.online && (
                <div className="fixed bottom-4 left-1/2 z-[100] -translate-x-1/2">
                    <div className="flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-bold text-white shadow-lg">
                        {/* wifi-off */}
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <line x1="2" y1="2" x2="22" y2="22" />
                            <path d="M8.5 16.5a5 5 0 0 1 7 0" />
                            <path d="M5 12.55a11 11 0 0 1 5.17-2.39" />
                            <path d="M10.71 5.05A16 16 0 0 1 22.58 9" />
                            <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
                            <line x1="12" y1="20" x2="12.01" y2="20" />
                        </svg>
                        <span>No internet connection</span>
                    </div>
                </div>
            )}
        </>
    );
};
