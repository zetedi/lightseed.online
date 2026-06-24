import React, { useEffect, useRef, useState } from 'react';
import { Icons } from './Icons';

// A dependency-free image cropper: pan (drag) + zoom (slider/wheel) over a fixed-aspect
// window, then draw the visible region to a canvas and hand back a cropped File. Rendered
// on a high z-index overlay so it sits above whatever modal opened the picker.
//
// `aspect` is width/height of the crop window (1 = square, 16/9 = wide banner, …).
export const ImageCropModal = ({
    file,
    aspect = 1,
    title = 'Crop image',
    onCancel,
    onConfirm,
}: {
    file: File;
    aspect?: number;
    title?: string;
    onCancel: () => void;
    onConfirm: (file: File) => void;
}) => {
    const [url, setUrl] = useState<string>('');
    const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
    const [zoom, setZoom] = useState(1);
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const [busy, setBusy] = useState(false);
    const imgRef = useRef<HTMLImageElement | null>(null);
    const drag = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);

    // Crop-window size in CSS px — responsive to small screens, fixed once for stable math.
    const [view] = useState(() => {
        const w = Math.min(320, (typeof window !== 'undefined' ? window.innerWidth : 360) - 72);
        return { w, h: Math.round(w / aspect) };
    });

    useEffect(() => {
        const objectUrl = URL.createObjectURL(file);
        setUrl(objectUrl);
        const img = new Image();
        img.onload = () => setNat({ w: img.naturalWidth, h: img.naturalHeight });
        img.src = objectUrl;
        return () => URL.revokeObjectURL(objectUrl);
    }, [file]);

    // Cover the crop window at zoom 1; multiply by zoom from there.
    const baseScale = nat ? Math.max(view.w / nat.w, view.h / nat.h) : 1;
    const scale = baseScale * zoom;
    const dispW = nat ? nat.w * scale : view.w;
    const dispH = nat ? nat.h * scale : view.h;

    const clamp = (p: { x: number; y: number }) => ({
        x: Math.min(0, Math.max(view.w - dispW, p.x)),
        y: Math.min(0, Math.max(view.h - dispH, p.y)),
    });

    // Centre the image once we know its size.
    useEffect(() => {
        if (nat) setPos({ x: (view.w - dispW) / 2, y: (view.h - dispH) / 2 });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [nat]);

    // Re-clamp whenever the displayed size changes (zoom), keeping the window covered.
    useEffect(() => {
        if (nat) setPos(p => clamp(p));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [zoom, nat]);

    const onPointerDown = (e: React.PointerEvent) => {
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        drag.current = { startX: e.clientX, startY: e.clientY, baseX: pos.x, baseY: pos.y };
    };
    const onPointerMove = (e: React.PointerEvent) => {
        if (!drag.current) return;
        setPos(clamp({
            x: drag.current.baseX + (e.clientX - drag.current.startX),
            y: drag.current.baseY + (e.clientY - drag.current.startY),
        }));
    };
    const onPointerUp = () => { drag.current = null; };

    const applyZoom = (next: number) => {
        const nz = Math.min(4, Math.max(1, next));
        if (!nat) { setZoom(nz); return; }
        // Zoom around the window centre so the framed subject stays put.
        const cx = view.w / 2, cy = view.h / 2;
        const oldScale = baseScale * zoom;
        const newScale = baseScale * nz;
        const imgX = (cx - pos.x) / oldScale;
        const imgY = (cy - pos.y) / oldScale;
        setZoom(nz);
        setPos(clamp({ x: cx - imgX * newScale, y: cy - imgY * newScale }));
    };

    const confirm = async () => {
        if (!nat) return;
        setBusy(true);
        try {
            // Map the crop window back to source-image pixels.
            const sx = Math.max(0, (0 - pos.x) / scale);
            const sy = Math.max(0, (0 - pos.y) / scale);
            const sw = Math.min(nat.w - sx, view.w / scale);
            const sh = Math.min(nat.h - sy, view.h / scale);
            const OUT_MAX = 1280;
            const outScale = Math.min(1, OUT_MAX / Math.max(sw, sh));
            const outW = Math.max(1, Math.round(sw * outScale));
            const outH = Math.max(1, Math.round(sh * outScale));
            const canvas = document.createElement('canvas');
            canvas.width = outW;
            canvas.height = outH;
            const ctx = canvas.getContext('2d');
            const source = imgRef.current;
            if (!ctx || !source) { onConfirm(file); return; }
            ctx.drawImage(source, sx, sy, sw, sh, 0, 0, outW, outH);
            // Preserve transparency for PNG sources (e.g. logos); JPEG for photos (smaller).
            const png = file.type === 'image/png';
            const type = png ? 'image/png' : 'image/jpeg';
            const blob: Blob | null = await new Promise(res => canvas.toBlob(res, type, 0.92));
            if (!blob) { onConfirm(file); return; }
            const name = (file.name || 'image').replace(/\.[^.]+$/, '') + (png ? '.png' : '.jpg');
            onConfirm(new File([blob], name, { type }));
        } catch {
            onConfirm(file); // never block the upload on a crop failure
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4" onClick={(e) => { e.stopPropagation(); onCancel(); }}>
            <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-800">{title}</h3>
                    <button type="button" onClick={onCancel} className="text-slate-400 hover:text-slate-600"><Icons.Close /></button>
                </div>

                <div
                    className="relative mx-auto touch-none overflow-hidden rounded-xl bg-slate-900 select-none"
                    style={{ width: view.w, height: view.h, cursor: drag.current ? 'grabbing' : 'grab' }}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerLeave={onPointerUp}
                    onWheel={e => applyZoom(zoom - Math.sign(e.deltaY) * 0.12)}
                >
                    {url && (
                        <img
                            ref={imgRef}
                            src={url}
                            draggable={false}
                            alt=""
                            style={{ position: 'absolute', left: pos.x, top: pos.y, width: dispW, height: dispH, maxWidth: 'none' }}
                        />
                    )}
                    {/* subtle framing grid */}
                    <div className="pointer-events-none absolute inset-0 ring-1 ring-white/30" />
                    {!nat && <div className="absolute inset-0 flex items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-white/40 border-t-transparent" /></div>}
                </div>

                <div className="mt-4 flex items-center gap-3">
                    <Icons.Camera />
                    <input
                        type="range" min={1} max={4} step={0.01} value={zoom}
                        onChange={e => applyZoom(parseFloat(e.target.value))}
                        className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-slate-200 accent-emerald-600"
                    />
                </div>
                <p className="mt-2 text-center text-[11px] text-slate-400">Drag to reposition · scroll or slide to zoom</p>

                <div className="mt-4 flex gap-2">
                    <button type="button" onClick={onCancel} className="flex-1 rounded-full border border-slate-200 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50">Cancel</button>
                    <button type="button" onClick={confirm} disabled={!nat || busy} className="flex-1 rounded-full bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
                        {busy ? 'Cropping…' : 'Use photo'}
                    </button>
                </div>
            </div>
        </div>
    );
};
