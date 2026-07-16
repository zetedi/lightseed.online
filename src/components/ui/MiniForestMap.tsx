import { useEffect, useRef } from 'react';
import { type Lifetree } from '../../types';
import { loadLeaflet } from '../../services/leaflet';
import { treeCoordinates } from '../../domain/views/forest';

// A small, non-interactive live map of the forest — the same satellite tiles + tree positions as
// the full forest view, shrunk to sit behind the Forest card. Every Leaflet interaction is off and
// the container is pointer-events-none, so a tap falls straight through to the card (which opens
// the real forest). No controls, no min-height, no clustering — just emerald dots where trees stand.
export const MiniForestMap = ({ trees, className = '' }: { trees: Lifetree[]; className?: string }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<any>(null);

    // Stable signature of the PLACED trees (lat/lng), so we rebuild only when the dots really change
    // — not on every parent render that hands us a fresh array identity.
    const key = trees
        .map(t => { const c = treeCoordinates(t); return c ? `${c.lat},${c.lng}` : ''; })
        .filter(Boolean)
        .join('|');

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
            // Same satellite basemap the forest view wears. `noWrap` keeps the world from tiling
            // sideways (no doubled continents) so the card frames one Earth.
            L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, noWrap: true }).addTo(map);

            const coords: [number, number][] = key ? key.split('|').map(s => { const [a, b] = s.split(',').map(Number); return [a, b]; }) : [];
            coords.forEach(([lat, lng]) => L.circleMarker([lat, lng], { radius: 4, weight: 1.5, color: '#ffffff', fillColor: '#34d399', fillOpacity: 0.95 }).addTo(map));
            // Snug bounds (little padding) so the node's trees fill the card rather than floating in ocean.
            if (coords.length) map.fitBounds(L.latLngBounds(coords).pad(0.12), { animate: false, maxZoom: 12 });

            // The container is laid out by the card AFTER mount; recompute size when it settles.
            ro = new ResizeObserver(() => { if (mapRef.current) mapRef.current.invalidateSize(); });
            ro.observe(containerRef.current);
        });
        return () => {
            cancelled = true;
            if (ro) ro.disconnect();
            if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
        };
    }, [key]);

    // A gentle wash — desaturated and lightened so the live map sits warm and quiet behind the card,
    // in the same key as the bark of the tree card rather than a loud, saturated satellite photo.
    return <div ref={containerRef} className={`pointer-events-none ${className}`} style={{ filter: 'saturate(0.6) brightness(1.08) contrast(0.93)' }} aria-hidden="true" />;
};
