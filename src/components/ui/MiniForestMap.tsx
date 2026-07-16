import { useEffect, useRef } from 'react';
import { loadLeaflet } from '../../services/leaflet';

export type MapPoint = { lat: number; lng: number; kind: 'lighthouse' | 'tree' };

// A small, non-interactive live map behind the Forest card — the same satellite tiles as the full
// forest view, marked only with the node's lighthouses (amber) and the mother trees they root into
// (emerald). Every Leaflet interaction is off and the container is pointer-events-none, so a tap
// falls straight through to the card (which opens the real forest). No controls, no clustering.
export const MiniForestMap = ({ points, className = '' }: { points: MapPoint[]; className?: string }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<any>(null);

    // Stable signature, so we rebuild only when the marks actually change — not on every render.
    const key = points.map(p => `${p.kind}:${p.lat},${p.lng}`).join('|');

    useEffect(() => {
        let cancelled = false;
        let ro: ResizeObserver | null = null;
        loadLeaflet().then((L: any) => {
            if (cancelled || !containerRef.current) return;
            if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
            const map = L.map(containerRef.current, {
                zoomControl: false, attributionControl: false,
                dragging: false, scrollWheelZoom: false, doubleClickZoom: false,
                boxZoom: false, keyboard: false, touchZoom: false, tap: false,
                zoomAnimation: false, fadeAnimation: false,
            }).setView([20, 0], 2);
            mapRef.current = map;
            // Same satellite basemap the forest view wears; noWrap keeps the world from doubling.
            L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, noWrap: true }).addTo(map);

            const pts = key ? key.split('|').map(s => {
                const [kind, ll] = s.split(':');
                const [lat, lng] = ll.split(',').map(Number);
                return { kind, lat, lng };
            }) : [];
            // Each mark is a little glowing lightseed — a warm yellow dot with a soft halo. Light
            // houses are a touch larger and ride above the mother trees when they share a spot.
            const seed = (kind: string) => {
                const size = kind === 'lighthouse' ? 16 : 12;
                return L.divIcon({
                    className: '',
                    iconSize: [size, size],
                    iconAnchor: [size / 2, size / 2],
                    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:#fde047;box-shadow:0 0 ${Math.round(size * 0.7)}px ${Math.round(size * 0.3)}px rgba(250,204,21,0.85);border:1px solid rgba(255,255,255,0.85);"></div>`,
                });
            };
            pts.forEach(p => L.marker([p.lat, p.lng], {
                icon: seed(p.kind), interactive: false, keyboard: false,
                zIndexOffset: p.kind === 'lighthouse' ? 1000 : 0,
            }).addTo(map));
            // Snug bounds so the node's marks fill the card rather than floating in ocean.
            if (pts.length) map.fitBounds(L.latLngBounds(pts.map(p => [p.lat, p.lng])).pad(0.25), { animate: false, maxZoom: 11 });

            ro = new ResizeObserver(() => { if (mapRef.current) mapRef.current.invalidateSize(); });
            ro.observe(containerRef.current);
        });
        return () => {
            cancelled = true;
            if (ro) ro.disconnect();
            if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
        };
    }, [key]);

    return <div ref={containerRef} className={`pointer-events-none ${className}`} aria-hidden="true" />;
};
