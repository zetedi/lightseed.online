import { useEffect, useRef } from 'react';
import { loadLeaflet } from '../../services/leaflet';

export type MapPoint = { lat: number; lng: number; kind: 'lighthouse' | 'tree' };

// A small, non-interactive live map behind the Forest card — the same satellite tiles as the full
// forest view, marked only with the node's light houses + the mother trees they root into (little
// glowing lightseeds). It opens on the whole world, then FLIES in smoothly once the marks load, so
// the shrink from big map → node reads as one motion. Every Leaflet interaction is off and the
// container is pointer-events-none, so a tap falls through to the card (which opens the real forest).
export const MiniForestMap = ({ points, className = '' }: { points: MapPoint[]; className?: string }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<any>(null);
    const layerRef = useRef<any>(null);
    const LRef = useRef<any>(null);

    // Stable signature so we only re-fly when the marks actually change (not on every render).
    const key = points.map(p => `${p.kind}:${p.lat},${p.lng}`).join('|');

    // Kept in a ref (stable identity) so both effects call the latest version without dep churn.
    const paintRef = useRef<() => void>(() => {});
    paintRef.current = () => {
        const L = LRef.current, map = mapRef.current, layer = layerRef.current;
        if (!L || !map || !layer) return;
        layer.clearLayers();
        const seed = (kind: string) => {
            const size = kind === 'lighthouse' ? 16 : 12;
            return L.divIcon({
                className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2],
                html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:#fde047;box-shadow:0 0 ${Math.round(size * 0.7)}px ${Math.round(size * 0.3)}px rgba(250,204,21,0.85);border:1px solid rgba(255,255,255,0.85);"></div>`,
            });
        };
        points.forEach(p => L.marker([p.lat, p.lng], {
            icon: seed(p.kind), interactive: false, keyboard: false,
            zIndexOffset: p.kind === 'lighthouse' ? 1000 : 0,
        }).addTo(layer));
        // Fly (not snap) to the snug bounds so the map eases in from the world view.
        if (points.length) map.flyToBounds(L.latLngBounds(points.map(p => [p.lat, p.lng])).pad(0.25), { maxZoom: 11, duration: 1.4 });
    };

    // Build the map ONCE — it persists across mark changes, so the fly-in is a real animation.
    useEffect(() => {
        let cancelled = false;
        let ro: ResizeObserver | null = null;
        loadLeaflet().then((L: any) => {
            if (cancelled || !containerRef.current || mapRef.current) return;
            const map = L.map(containerRef.current, {
                zoomControl: false, attributionControl: false,
                dragging: false, scrollWheelZoom: false, doubleClickZoom: false,
                boxZoom: false, keyboard: false, touchZoom: false, tap: false,
            }).setView([20, 0], 2);
            L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, noWrap: true }).addTo(map);
            mapRef.current = map; LRef.current = L; layerRef.current = L.layerGroup().addTo(map);
            ro = new ResizeObserver(() => { if (mapRef.current) mapRef.current.invalidateSize(); });
            ro.observe(containerRef.current);
            paintRef.current(); // paint whatever marks we already have (and fly if any)
        });
        return () => {
            cancelled = true;
            if (ro) ro.disconnect();
            if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; layerRef.current = null; LRef.current = null; }
        };
    }, []);

    // Re-paint + fly whenever the marks change (typically: empty → loaded).
    useEffect(() => { paintRef.current(); }, [key]);

    return <div ref={containerRef} className={`pointer-events-none ${className}`} aria-hidden="true" />;
};
