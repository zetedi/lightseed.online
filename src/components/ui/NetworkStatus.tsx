import { useEffect, useState, useSyncExternalStore } from 'react';
import { subscribeNet, getNetSnapshot, initNetworkWatch } from '../../services/network';

// THE NETWORK'S FACE — mounted once at the app root. Three truths, told plainly:
//   SLOW: when tracked requests stay on the wire past the grace period, the whole container
//         dims a touch (a little darker than when it's loaded) until the wire is quiet. No
//         second sun: pages already show their own loader, and two suns clashed (Zoltán,
//         2026-07-22) — the dim is the global signal, the page's loader the local one.
//   UPLOADING: a running photo upload shows immediately as an "Uploading: N%" pill.
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

    return (
        <>
            {slow && busy && (
                <div className="pointer-events-none fixed inset-0 z-[85] bg-slate-900/10 animate-in fade-in duration-500" aria-hidden="true" />
            )}
            {net.uploadPct !== null && (
                /* Bottom centre, out of the header's way: a small card with a real progress
                   bar, one look for every upload in the app (no more stray blue circles). */
                <div className="pointer-events-none fixed bottom-6 left-1/2 z-[95] -translate-x-1/2">
                    <div className="w-60 rounded-2xl border border-amber-200/80 bg-white/95 px-4 py-3 shadow-xl backdrop-blur">
                        <div className="mb-2 flex items-center justify-between text-[11px] font-bold">
                            <span className="text-slate-600">Uploading photo</span>
                            <span className="tabular-nums text-amber-600">{net.uploadPct}%</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-amber-100">
                            <div
                                className="h-full rounded-full bg-gradient-to-r from-amber-300 to-amber-500 transition-[width] duration-300"
                                style={{ width: `${net.uploadPct}%` }}
                            />
                        </div>
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
