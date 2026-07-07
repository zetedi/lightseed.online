import { useEffect, useState } from 'react';

// Cookie / local-storage consent banner — shown once at the bottom until accepted, then remembered
// in localStorage. Extracted from App verbatim.
export const GDPRBanner = () => {
    const [visible, setVisible] = useState(false);
    const [checked, setChecked] = useState(false);

    useEffect(() => {
        const consent = localStorage.getItem('lifeseed_gdpr');
        if (!consent) setVisible(true);
    }, []);

    const handleAccept = () => {
        if (!checked) return;
        localStorage.setItem('lifeseed_gdpr', 'true');
        setVisible(false);
    }

    if (!visible) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-50 animate-in slide-in-from-bottom-full duration-500">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                <p className="text-xs text-slate-600 text-center md:text-left max-w-2xl">
                    We use cookies and local storage to ensure you get the best experience on lightseed. By continuing, you agree to our terms and privacy policy.
                </p>
                <div className="flex flex-col sm:flex-row items-center gap-4">
                    <label className="flex items-center gap-2 text-sm text-slate-800 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={checked}
                            onChange={e => setChecked(e.target.checked)}
                            className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                        />
                        <span className="font-medium">I accept</span>
                    </label>
                    <button
                        onClick={handleAccept}
                        disabled={!checked}
                        className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-full text-xs font-bold transition-colors shadow-sm"
                    >
                        Confirm
                    </button>
                </div>
            </div>
        </div>
    );
}
