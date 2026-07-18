import { useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Modal } from './Modal';
import { Icons } from './Icons';
import { beingUrl, isQrStale } from '../../domain/beingLink';
import { notify } from './Toast';

// The being's QR — its offline/online bridge. A small icon on every being's profile opens
// the code; the URL inside carries the LID (the true name), so paper printed today keeps
// working wherever the being's story goes. The first opening MINTS the link onto the being
// (lazily); if the domain later changes, the mint reads stale and a keeper can refresh it.

interface BeingQrProps {
    lid?: string;
    name: string;
    savedHref?: string;
    canMint?: boolean;
    onMint?: (href: string) => Promise<void>;
    className?: string;
}

export const BeingQr = ({ lid, name, savedHref, canMint = false, onMint, className = '' }: BeingQrProps) => {
    const [open, setOpen] = useState(false);
    const [dataUrl, setDataUrl] = useState<string | null>(null);
    const [href, setHref] = useState<string | null>(savedHref || null);
    const mintedRef = useRef(false);

    if (!lid) return null;
    const liveHref = beingUrl(lid, window.location.origin);
    const stale = isQrStale(href || undefined, lid, window.location.origin);

    const show = async () => {
        setOpen(true);
        const target = href || liveHref;
        setDataUrl(await QRCode.toDataURL(target, { width: 512, margin: 2, color: { dark: '#0f172a', light: '#ffffff' } }));
        // Lazy mint: the first time a keeper opens the code, the being remembers its link.
        if (!href && canMint && onMint && !mintedRef.current) {
            mintedRef.current = true;
            onMint(liveHref).then(() => setHref(liveHref)).catch(() => { mintedRef.current = false; });
        }
        if (!href) setHref(liveHref);
    };

    const refresh = async () => {
        if (!onMint) return;
        try {
            await onMint(liveHref);
            setHref(liveHref);
            setDataUrl(await QRCode.toDataURL(liveHref, { width: 512, margin: 2, color: { dark: '#0f172a', light: '#ffffff' } }));
            notify('QR link refreshed.');
        } catch {
            notify('Could not refresh the QR link.', 'error');
        }
    };

    return (
        <>
            <button
                type="button"
                onClick={show}
                title="QR code: this being's offline link"
                aria-label={`QR code for ${name}`}
                className={`inline-flex items-center justify-center rounded-full transition-colors ${className}`}
            >
                <Icons.QrCode size={16} />
            </button>

            {open && (
                <Modal title={name} onClose={() => setOpen(false)}>
                    <div className="flex flex-col items-center gap-4 text-center">
                        {dataUrl
                            ? <img src={dataUrl} alt={`QR code linking to ${name}`} className="h-56 w-56 rounded-xl border border-slate-200 shadow-sm" />
                            : <div className="flex h-56 w-56 items-center justify-center text-slate-300">…</div>}
                        <p className="break-all font-mono text-[11px] text-slate-400">{href || liveHref}</p>
                        <p className="max-w-xs text-xs text-slate-500">
                            Scan to open this being. The link carries its true name (lid), for paper, posters, and the world offline.
                        </p>
                        {stale && (
                            <div className="w-full rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                                This code was minted on another domain. {canMint ? 'Refresh it to point here.' : 'A keeper can refresh it.'}
                            </div>
                        )}
                        <div className="flex flex-wrap justify-center gap-2">
                            {dataUrl && (
                                <a href={dataUrl} download={`${name.replace(/[^\w-]+/g, '-').toLowerCase() || 'being'}-qr.png`}
                                   className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-emerald-700">
                                    Download PNG
                                </a>
                            )}
                            {stale && canMint && (
                                <button onClick={refresh} className="rounded-full border border-amber-300 bg-amber-100 px-4 py-2 text-xs font-bold text-amber-800 transition-colors hover:bg-amber-200">
                                    Refresh link
                                </button>
                            )}
                        </div>
                    </div>
                </Modal>
            )}
        </>
    );
};
