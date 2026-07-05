
import React, { useRef, useEffect, useMemo, useState } from 'react';
import { type Lifetree } from '../types';
import { isExplicitlyValidatedTree } from '../utils/validation';
import { isWateringOverdue } from '../domain/watering';
import { Loading } from './ui/Loading';
import { Icons } from './ui/Icons';
import { treeCoordinates as getTreeCoordinates, forestMarkers } from '../domain/views/forest';
import { firestoreStore } from '../adapters/firestore';

interface Cluster {
    id: string;
    center: Lifetree;
    children: Lifetree[];
    lat: number;
    lng: number;
}

interface StackLevel {
    clusterId: string;  // ID of the root cluster (for matching which cluster is open)
    trees: Lifetree[];  // [center, ...petals, ...remaining]
    lat: number;
    lng: number;
}

export const ForestMap = ({ trees, onView, onReach, loading = false, onRefresh, primaryTree = null, refreshKey = 0 }: { trees: Lifetree[], onView: (tree: Lifetree) => void, onReach?: (tree: Lifetree) => void, loading?: boolean, onRefresh?: () => void, primaryTree?: Lifetree | null, refreshKey?: number }) => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<any>(null);
    const markersLayer = useRef<any>(null);
    const updateMarkersRef = useRef<(L: any, force?: boolean) => void>(() => {});
    const expansionStackRef = useRef<StackLevel[]>([]);
    const lastMarkerRenderKeyRef = useRef('');
    // Ensures we only auto-frame the primary lifetree once (not on every data refresh,
    // so we never yank the view back while the user is panning around).
    const didInitialFocusRef = useRef(false);

    const [expansionStack, setExpansionStack] = useState<StackLevel[]>([]);
    const [isMapReady, setIsMapReady] = useState(false);
    const [markerCount, setMarkerCount] = useState(0);
    const visibleTrees = useMemo(() => trees.filter(tree => getTreeCoordinates(tree)), [trees]);
    const visibleTreeCount = visibleTrees.length;
    // Guardian counts come from the LIN (all 'guardian' edges), fetched and grouped by tree.
    // refreshKey re-fetches after we touch a tree (e.g. join/leave a guardianship in a detail view).
    const [guardianCounts, setGuardianCounts] = useState<Map<string, number>>(new Map());
    useEffect(() => {
        let alive = true;
        firestoreStore.linksByRel('guardian').then(links => {
            if (!alive) return;
            const counts = new Map<string, number>();
            for (const l of links) counts.set(l.to, (counts.get(l.to) || 0) + 1);
            setGuardianCounts(counts);
        }).catch(() => {});
        return () => { alive = false; };
    }, [trees, refreshKey]);
    // Memoized + slimmed: only fields that change a marker's appearance. Excludes
    // name/body (heavy text, irrelevant to markers) so this isn't rebuilt megabyte-sized
    // on every render — a major cost once the map holds hundreds of trees.
    const treesSignature = useMemo(() => forestMarkers(visibleTrees, guardianCounts).map(m =>
        [m.id, m.name, m.lat, m.lng, m.status, m.kind, m.imageUrl, m.growthUrl, m.guardianCount, m.validated ? 'validated' : ''].join(':')
    ).join('|') + '#' + visibleTrees.filter(t => isWateringOverdue(t)).map(t => t.id).join(','), [visibleTrees, guardianCounts]);
    const expansionSignature = expansionStack.map(level => `${level.clusterId}:${level.lat}:${level.lng}:${level.trees.map(tree => tree.id).join(',')}`).join('|');

    useEffect(() => {
        expansionStackRef.current = expansionStack;
    }, [expansionStack]);

    // Lightseed Logo SVG String for Cluster Icon
    const logoSvg = `
    <svg width="100%" height="100%" viewBox="0 0 262 262" xmlns="http://www.w3.org/2000/svg">
        <defs><clipPath id="c"><circle cx="131" cy="131" r="131" /></clipPath></defs>
        <g>
            <circle cx="131" cy="131" r="131" fill="white" stroke="#334155" stroke-width="7" clip-path="url(#c)" />
            <circle cx="-35.28" cy="-29" r="64" fill="none" stroke="#334155" stroke-width=".7" clip-path="url(#c)" />
            <circle cx="-35.28" cy="35" r="64" fill="none" stroke="#334155" stroke-width=".7" clip-path="url(#c)" />
            <circle cx="-35.28" cy="99" r="64" fill="none" stroke="#334155" stroke-width=".7" clip-path="url(#c)" />
            <circle cx="-35.28" cy="163" r="64" fill="none" stroke="#334155" stroke-width=".7" clip-path="url(#c)" />
            <circle cx="-35.28" cy="227" r="64" fill="none" stroke="#334155" stroke-width=".7" clip-path="url(#c)" />
            <circle cx="-35.28" cy="291" r="64" fill="none" stroke="#334155" stroke-width=".7" clip-path="url(#c)" />
            <circle cx="20.15" cy="3" r="64" fill="none" stroke="#334155" stroke-width=".7" clip-path="url(#c)" />
            <circle cx="20.15" cy="67" r="64" fill="none" stroke="#334155" stroke-width=".7" clip-path="url(#c)" />
            <circle cx="20.15" cy="131" r="64" fill="none" stroke="#334155" stroke-width=".7" clip-path="url(#c)" />
            <circle cx="20.15" cy="195" r="64" fill="none" stroke="#334155" stroke-width=".7" clip-path="url(#c)" />
            <circle cx="20.15" cy="259" r="64" fill="none" stroke="#334155" stroke-width=".7" clip-path="url(#c)" />
            <circle cx="75.57" cy="-29" r="64" fill="none" stroke="#334155" stroke-width=".7" clip-path="url(#c)" />
            <circle cx="75.57" cy="35" r="64" fill="none" stroke="#334155" stroke-width=".7" clip-path="url(#c)" />
            <circle cx="75.57" cy="99" r="64" fill="none" stroke="#334155" stroke-width=".7" clip-path="url(#c)" />
            <circle cx="75.57" cy="163" r="64" fill="none" stroke="#334155" stroke-width=".7" clip-path="url(#c)" />
            <circle cx="75.57" cy="227" r="64" fill="none" stroke="#334155" stroke-width=".7" clip-path="url(#c)" />
            <circle cx="75.57" cy="291" r="64" fill="none" stroke="#334155" stroke-width=".7" clip-path="url(#c)" />
            <circle cx="131" cy="3" r="64" fill="none" stroke="#334155" stroke-width=".7" clip-path="url(#c)" />
            <circle cx="131" cy="67" r="64" fill="none" stroke="#334155" stroke-width=".7" clip-path="url(#c)" />
            <circle cx="131" cy="131" r="64" fill="none" stroke="#334155" stroke-width=".7" clip-path="url(#c)" />
            <circle cx="131" cy="195" r="64" fill="none" stroke="#334155" stroke-width=".7" clip-path="url(#c)" />
            <circle cx="131" cy="259" r="64" fill="none" stroke="#334155" stroke-width=".7" clip-path="url(#c)" />
            <circle cx="186.43" cy="-29" r="64" fill="none" stroke="#334155" stroke-width=".7" clip-path="url(#c)" />
            <circle cx="186.43" cy="35" r="64" fill="none" stroke="#334155" stroke-width=".7" clip-path="url(#c)" />
            <circle cx="186.43" cy="99" r="64" fill="none" stroke="#334155" stroke-width=".7" clip-path="url(#c)" />
            <circle cx="186.43" cy="163" r="64" fill="none" stroke="#334155" stroke-width=".7" clip-path="url(#c)" />
            <circle cx="186.43" cy="227" r="64" fill="none" stroke="#334155" stroke-width=".7" clip-path="url(#c)" />
            <circle cx="186.43" cy="291" r="64" fill="none" stroke="#334155" stroke-width=".7" clip-path="url(#c)" />
            <circle cx="241.85" cy="3" r="64" fill="none" stroke="#334155" stroke-width=".7" clip-path="url(#c)" />
            <circle cx="241.85" cy="67" r="64" fill="none" stroke="#334155" stroke-width=".7" clip-path="url(#c)" />
            <circle cx="241.85" cy="131" r="64" fill="none" stroke="#334155" stroke-width=".7" clip-path="url(#c)" />
            <circle cx="241.85" cy="195" r="64" fill="none" stroke="#334155" stroke-width=".7" clip-path="url(#c)" />
            <circle cx="241.85" cy="259" r="64" fill="none" stroke="#334155" stroke-width=".7" clip-path="url(#c)" />
            <circle cx="297.28" cy="-29" r="64" fill="none" stroke="#334155" stroke-width=".7" clip-path="url(#c)" />
            <circle cx="297.28" cy="35" r="64" fill="none" stroke="#334155" stroke-width=".7" clip-path="url(#c)" />
            <circle cx="297.28" cy="99" r="64" fill="none" stroke="#334155" stroke-width=".7" clip-path="url(#c)" />
            <circle cx="297.28" cy="163" r="64" fill="none" stroke="#334155" stroke-width=".7" clip-path="url(#c)" />
            <circle cx="297.28" cy="227" r="64" fill="none" stroke="#334155" stroke-width=".7" clip-path="url(#c)" />
            <circle cx="297.28" cy="291" r="64" fill="none" stroke="#334155" stroke-width=".7" clip-path="url(#c)" />
            <circle cx="75.57" cy="99" r="16" fill="white" stroke="#334155" stroke-width="3" clip-path="url(#c)" />
            <circle cx="75.57" cy="163" r="16" fill="white" stroke="#334155" stroke-width="3" clip-path="url(#c)" />
            <circle cx="131" cy="67" r="16" fill="white" stroke="#334155" stroke-width="3" clip-path="url(#c)" />
            <circle cx="131" cy="131" r="16" fill="white" stroke="#334155" stroke-width="3" clip-path="url(#c)" />
            <circle cx="131" cy="195" r="16" fill="white" stroke="#334155" stroke-width="3" clip-path="url(#c)" />
            <circle cx="186.43" cy="99" r="16" fill="white" stroke="#334155" stroke-width="3" clip-path="url(#c)" />
            <circle cx="186.43" cy="163" r="16" fill="white" stroke="#334155" stroke-width="3" clip-path="url(#c)" />
        </g>
    </svg>`;

    const getPopupOptions = (lat: number, lng: number) => {
        const point = mapInstance.current?.latLngToContainerPoint([lat, lng]);
        const openBelow = point ? point.y < 170 : false;

        return {
            autoPan: false,
            closeButton: false,
            offset: openBelow ? ([0, 18] as [number, number]) : ([0, -18] as [number, number]),
            className: openBelow ? 'forest-popup-below' : 'forest-popup-above',
        };
    };

    useEffect(() => {
        const checkLeaflet = setInterval(() => {
            const L = (window as any).L;
            if (L && mapContainer.current) {
                clearInterval(checkLeaflet);
                initMap(L);
            }
        }, 100);
        return () => clearInterval(checkLeaflet);
    }, []);

    const initMap = (L: any) => {
        if (!mapContainer.current || mapInstance.current) return;

        mapInstance.current = L.map(mapContainer.current, {
            zoomControl: false,
            attributionControl: false
        }).setView([20, 0], 2);
        mapInstance.current.whenReady(() => setIsMapReady(true));

        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
            maxZoom: 19
        }).addTo(mapInstance.current);

        L.control.zoom({ position: 'bottomright' }).addTo(mapInstance.current);
        markersLayer.current = L.layerGroup().addTo(mapInstance.current);

        mapInstance.current.on('zoomend', () => {
            if (expansionStackRef.current.length > 0) {
                setExpansionStack([]);
            } else {
                updateMarkersRef.current(L, true);
            }
        });

        // Click on map background collapses everything
        mapInstance.current.on('click', () => {
            setExpansionStack(prev => prev.length > 0 ? [] : prev);
        });

        setTimeout(() => {
            mapInstance.current?.invalidateSize();
            updateMarkersRef.current(L, true);
        }, 250);
    }

    useEffect(() => {
        const L = (window as any).L;
        if (!L || !mapInstance.current || !isMapReady) return;
        const timer = window.setTimeout(() => {
            mapInstance.current?.invalidateSize();
            updateMarkersRef.current(L);
        }, 50);
        return () => window.clearTimeout(timer);
    }, [treesSignature, expansionSignature, loading, isMapReady]);

    useEffect(() => {
        if (!isMapReady || loading || visibleTreeCount === 0 || markerCount > 0) return;
        const L = (window as any).L;
        if (!L || !mapInstance.current) return;

        const retry = window.setTimeout(() => {
            mapInstance.current?.invalidateSize();
            updateMarkersRef.current(L, true);
        }, 250);

        return () => window.clearTimeout(retry);
    }, [isMapReady, loading, visibleTreeCount, markerCount, treesSignature, expansionSignature]);

    // Default view: zoom in to frame at least the seven nearest lifetrees, so the user
    // always lands on a populated view (not an empty ocean).
    useEffect(() => {
        if (!isMapReady || didInitialFocusRef.current) return;
        const L = (window as any).L;
        if (!L || !mapInstance.current || !primaryTree) return;
        const center = getTreeCoordinates(primaryTree);
        if (!center) return;

        const located = visibleTrees
            .map(getTreeCoordinates)
            .filter(Boolean) as { lat: number; lng: number }[];
        if (located.length === 0) return; // trees not loaded yet — retry when they arrive
        didInitialFocusRef.current = true;

        const nearest = located
            .map(c => ({ c, d: (c.lat - center.lat) ** 2 + (c.lng - center.lng) ** 2 }))
            .sort((a, b) => a.d - b.d)
            .slice(0, 7)
            .map(x => x.c);

        if (nearest.length >= 2) {
            const bounds = L.latLngBounds(nearest.map(c => [c.lat, c.lng]));
            mapInstance.current.fitBounds(bounds.pad(0.3), { animate: false, maxZoom: 16 });
        } else {
            // Only one tree to show — fall back to a ~100 km radius around it.
            mapInstance.current.fitBounds(L.latLng(center.lat, center.lng).toBounds(200000), { animate: false });
        }
    }, [isMapReady, primaryTree, treesSignature]);

    const getHtmlForTree = (tree: Lifetree, isSmall = false, delay = 0) => {
        const isNature = tree.isNature;
        const isDanger = tree.status === 'DANGER';
        const guardianCount = guardianCounts.get(tree.id) || 0;
        const sizeClass = isSmall ? 'w-10 h-10' : 'w-12 h-12';
        const borderClass = isSmall ? 'border' : 'border-2';
        const displayImage = tree.latestGrowthUrl || tree.imageUrl || 'https://via.placeholder.com/150';
        const imgStyle = "width: 100%; height: 100%; object-fit: cover; display: block;";
        const animStyle = `animation-delay: ${delay}ms;`;

        if (isNature) {
            return `
            <div class="marker-pop relative ${sizeClass} hover:scale-110 transition-transform duration-300 group" style="${animStyle}">
                ${isWateringOverdue(tree) ? '<div class="absolute -inset-1 rounded-full border-2 border-sky-400 animate-pulse z-20"></div>' : ''}
                <div class="absolute inset-0 bg-sky-500 rounded-full animate-pulse opacity-20"></div>
                <div class="relative ${sizeClass} rounded-full ${borderClass} border-white shadow-xl overflow-hidden bg-white z-10">
                    <img src="${displayImage}" style="${imgStyle}" class="w-full h-full object-cover" />
                </div>
                <div class="absolute -top-1 -right-1 z-20 w-4 h-4 bg-sky-500 border border-white rounded-full flex items-center justify-center text-[8px] text-white font-bold shadow-md">
                    ${guardianCount}
                </div>
                ${isDanger ? `<div class="absolute -top-1 -left-1 z-20 w-3 h-3 bg-red-500 border border-white rounded-full animate-bounce"></div>` : ''}
            </div>`;
        }

        return `
        <div class="marker-pop relative ${sizeClass} hover:scale-110 transition-transform duration-300" style="${animStyle}">
            ${isWateringOverdue(tree) ? '<div class="absolute -inset-1 rounded-full border-2 border-sky-400 animate-pulse z-20"></div>' : ''}
            <div class="absolute inset-0 bg-emerald-500 rounded-full animate-ping opacity-20"></div>
            <div class="relative ${sizeClass} rounded-full ${borderClass} border-white shadow-xl overflow-hidden bg-white">
                <img src="${displayImage}" style="${imgStyle}" class="w-full h-full object-cover" />
            </div>
            ${isExplicitlyValidatedTree(tree) ? '<div class="absolute -top-2 -right-2 rounded-full border border-emerald-200 bg-white/95 px-1.5 py-0.5 text-[8px] font-black tracking-[0.2em] text-yellow-400 shadow-sm">V<span class="ml-0.5 text-[6px] font-bold tracking-[0.12em] text-emerald-700">validated</span></div>' : ''}
            ${isDanger ? `<div class="absolute -top-1 -left-1 z-20 w-3 h-3 bg-red-500 border border-white rounded-full animate-bounce"></div>` : ''}
        </div>`;
    }

    const clusterImage = (tree: Lifetree) => tree.latestGrowthUrl || tree.imageUrl || 'https://via.placeholder.com/150';

    // A cluster of nearby trees as a pie of their images (up to 4 slices, rest in the count badge).
    const getClusterPieHtml = (trees: Lifetree[], clusterId: string) => {
        const shown = trees.slice(0, 4);
        const k = shown.length;
        const size = 64;
        const cx = size / 2, cy = size / 2, r = size / 2 - 2;
        const safe = clusterId.replace(/[^a-zA-Z0-9]/g, '');

        if (k <= 1) {
            return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><defs><clipPath id="cc${safe}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath></defs><circle cx="${cx}" cy="${cy}" r="${r}" fill="#e2e8f0"/><image href="${clusterImage(shown[0])}" x="0" y="0" width="${size}" height="${size}" preserveAspectRatio="xMidYMid slice" clip-path="url(#cc${safe})"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="white" stroke-width="2"/></svg>`;
        }

        let defs = '';
        let body = '';
        for (let i = 0; i < k; i++) {
            const a0 = (i / k) * 2 * Math.PI - Math.PI / 2;
            const a1 = ((i + 1) / k) * 2 * Math.PI - Math.PI / 2;
            const x0 = (cx + r * Math.cos(a0)).toFixed(2), y0 = (cy + r * Math.sin(a0)).toFixed(2);
            const x1 = (cx + r * Math.cos(a1)).toFixed(2), y1 = (cy + r * Math.sin(a1)).toFixed(2);
            const large = (a1 - a0) > Math.PI ? 1 : 0;
            const path = `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`;
            const id = `s${safe}_${i}`;
            defs += `<clipPath id="${id}"><path d="${path}"/></clipPath>`;
            body += `<image href="${clusterImage(shown[i])}" x="0" y="0" width="${size}" height="${size}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${id})"/><path d="${path}" fill="none" stroke="white" stroke-width="1.5"/>`;
        }
        return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><defs>${defs}</defs><circle cx="${cx}" cy="${cy}" r="${r}" fill="#e2e8f0"/>${body}<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="white" stroke-width="2"/></svg>`;
    };

    const createPopupContent = (tree: Lifetree) => {
        const displayImage = tree.latestGrowthUrl || tree.imageUrl;
        const div = document.createElement('div');
        div.innerHTML = `
            <div class="text-center min-w-[160px]">
                ${displayImage ? `<img src="${displayImage}" style="width:100%;height:120px;object-fit:cover;display:block;" class="rounded-t-lg" />` : ''}
                <div class="p-2">
                    <h3 class="font-bold text-sm text-slate-800 mb-1">${tree.name}</h3>
                    <p class="text-xs text-slate-500 line-clamp-2 italic mb-2">"${tree.body}"</p>
                    <div class="grid grid-cols-2 gap-2">
                        <button class="view-btn bg-emerald-600 text-white text-xs font-bold px-3 py-1.5 rounded-full w-full">View</button>
                        <button class="reach-btn bg-amber-500 text-white text-xs font-bold px-3 py-1.5 rounded-full w-full">Reach</button>
                    </div>
                </div>
            </div>
        `;
        div.querySelector('.view-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            onView(tree);
        });
        div.querySelector('.reach-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            onReach?.(tree);
        });
        return div;
    }

    const updateMarkers = (L: any, force = false) => {
        if (!markersLayer.current || !mapInstance.current) return;

        const CLUSTER_THRESHOLD_PX = 50;
        const clusters: Cluster[] = [];
        const processed = new Set<string>();
        const map = mapInstance.current;
        const nextLayer = L.layerGroup();
        let nextMarkerCount = 0;
        const renderKey = `${map.getZoom?.() || ''}|${treesSignature}|${expansionSignature}|${loading ? 'loading' : 'ready'}`;

        if (!force && renderKey === lastMarkerRenderKeyRef.current) return;
        lastMarkerRenderKeyRef.current = renderKey;

        const sortedTrees = [...visibleTrees].sort((a, b) =>
            (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)
        );

        // Project every tree to pixel space ONCE (the costly step), then cluster on the
        // cached points with squared-distance math — avoids ~n² Leaflet projections + sqrt.
        const points = sortedTrees.map(tree => {
            const coords = getTreeCoordinates(tree);
            if (!coords) return null;
            const p = map.latLngToLayerPoint([coords.lat, coords.lng]);
            return { tree, lat: coords.lat, lng: coords.lng, x: p.x, y: p.y };
        });
        const thresholdSq = CLUSTER_THRESHOLD_PX * CLUSTER_THRESHOLD_PX;

        for (let i = 0; i < points.length; i++) {
            const a = points[i];
            if (!a || processed.has(a.tree.id)) continue;
            const cluster: Cluster = { id: a.tree.id, center: a.tree, children: [], lat: a.lat, lng: a.lng };
            processed.add(a.tree.id);

            for (let j = i + 1; j < points.length; j++) {
                const b = points[j];
                if (!b || processed.has(b.tree.id)) continue;
                const dx = a.x - b.x;
                const dy = a.y - b.y;
                if (dx * dx + dy * dy < thresholdSq) {
                    cluster.children.push(b.tree);
                    processed.add(b.tree.id);
                }
            }

            clusters.push(cluster);
        }

        // Determine active expansion state
        const topLevel = expansionStack.length > 0 ? expansionStack[expansionStack.length - 1] : null;
        const activeClusterId = expansionStack.length > 0 ? expansionStack[0].clusterId : null;

        clusters.forEach(cluster => {
            const count = 1 + cluster.children.length;

            if (count === 1) {
                // SINGLE TREE
                const icon = L.divIcon({
                    html: getHtmlForTree(cluster.center),
                    className: '',
                    iconSize: [48, 48],
                    iconAnchor: [24, 24],
                    popupAnchor: [0, -24]
                });
                L.marker([cluster.lat, cluster.lng], { icon })
                 .addTo(nextLayer)
                 .bindPopup(createPopupContent(cluster.center), getPopupOptions(cluster.lat, cluster.lng));
                nextMarkerCount += 1;

            } else if (cluster.id === activeClusterId && topLevel) {
                // EXPANDED — Seed of Life using current top-of-stack level
                // Deeper stack levels get higher z-index so they render on top
                const stackDepth = expansionStack.length;
                const depthZOffset = stackDepth * 1000;

                const centerTree = topLevel.trees[0];
                const children = topLevel.trees.slice(1);
                const hasMore = children.length > 6;
                // If overflow exists, reserve slot 5 (index 5) for the sub-cluster node
                const visibleChildren = hasMore ? children.slice(0, 5) : children;
                const remainingTrees = hasMore ? children.slice(5) : [];

                const centerPoint = map.latLngToLayerPoint([topLevel.lat, topLevel.lng]);

                // Sun-to-emerald vignette circle behind the expansion
                const vignetteSize = 180;
                const vignetteHtml = `<div style="width:${vignetteSize}px;height:${vignetteSize}px;border-radius:50%;background:radial-gradient(circle, rgba(253,224,71,0.5) 0%, rgba(167,243,208,0.3) 35%, rgba(110,231,183,0.15) 60%, transparent 80%);pointer-events:none;"></div>`;
                const vignetteIcon = L.divIcon({
                    html: vignetteHtml,
                    className: '',
                    iconSize: [vignetteSize, vignetteSize],
                    iconAnchor: [vignetteSize / 2, vignetteSize / 2]
                });
                L.marker([topLevel.lat, topLevel.lng], { icon: vignetteIcon, interactive: false, zIndexOffset: depthZOffset - 500 })
                 .addTo(nextLayer);
                nextMarkerCount += 1;

                // X button — positioned above the center
                const xPoint = map.layerPointToLatLng(L.point(centerPoint.x, centerPoint.y - 72));
                const isDeep = expansionStack.length > 1;
                const xHtml = `
                <div class="marker-pop flex items-center justify-center w-8 h-8 rounded-full border-2 border-white shadow-lg cursor-pointer hover:scale-110 transition-transform"
                     style="background:${isDeep ? '#f59e0b' : '#ef4444'};animation-delay:0ms;">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" style="width:12px;height:12px;">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </div>`;
                const xIcon = L.divIcon({ html: xHtml, className: '', iconSize: [32, 32], iconAnchor: [16, 16] });
                const xMarker = L.marker(xPoint, { icon: xIcon, zIndexOffset: depthZOffset + 500 });
                xMarker.on('click', (e: any) => {
                    L.DomEvent.stopPropagation(e);
                    setExpansionStack(prev => prev.slice(0, -1));
                });
                xMarker.addTo(nextLayer);
                nextMarkerCount += 1;

                // Center tree
                const centerIcon = L.divIcon({
                    html: getHtmlForTree(centerTree, false, 0),
                    className: '',
                    iconSize: [48, 48],
                    iconAnchor: [24, 24]
                });
                L.marker([topLevel.lat, topLevel.lng], { icon: centerIcon, zIndexOffset: depthZOffset })
                 .addTo(nextLayer)
                 .bindPopup(createPopupContent(centerTree), getPopupOptions(topLevel.lat, topLevel.lng));
                nextMarkerCount += 1;

                // Petals
                visibleChildren.forEach((child, index) => {
                    const angle = (index * 60) * (Math.PI / 180);
                    const radius = 45;
                    const childPoint = L.point(
                        centerPoint.x + radius * Math.cos(angle),
                        centerPoint.y + radius * Math.sin(angle)
                    );
                    const childLatLng = map.layerPointToLatLng(childPoint);

                    L.polyline([[topLevel.lat, topLevel.lng], childLatLng], {
                        color: 'white', weight: 1, opacity: 0.3
                    }).addTo(nextLayer);

                    const childIcon = L.divIcon({
                        html: getHtmlForTree(child, true, (index + 1) * 50),
                        className: '',
                        iconSize: [40, 40],
                        iconAnchor: [20, 20],
                        popupAnchor: [0, -20]
                    });
                    L.marker(childLatLng, { icon: childIcon, zIndexOffset: depthZOffset })
                     .addTo(nextLayer)
                     .bindPopup(createPopupContent(child), getPopupOptions(childLatLng.lat, childLatLng.lng));
                    nextMarkerCount += 1;
                });

                // Sub-cluster node at slot 5 if there are more trees
                if (hasMore) {
                    const angle = (5 * 60) * (Math.PI / 180);
                    const radius = 45;
                    const morePoint = L.point(
                        centerPoint.x + radius * Math.cos(angle),
                        centerPoint.y + radius * Math.sin(angle)
                    );
                    const moreLatLng = map.layerPointToLatLng(morePoint);
                    const moreDanger = remainingTrees.some(t => t.status === 'DANGER');

                    L.polyline([[topLevel.lat, topLevel.lng], moreLatLng], {
                        color: 'white', weight: 1, opacity: 0.3
                    }).addTo(nextLayer);

                    const moreHtml = `
                    <div class="marker-pop relative w-10 h-10 cursor-pointer hover:scale-110 transition-transform duration-300" style="animation-delay:${6 * 50}ms;">
                        <div class="absolute inset-0 drop-shadow-lg">
                            ${logoSvg}
                        </div>
                        <div class="absolute -top-1 -right-1 w-5 h-5 bg-emerald-600 border-2 border-white text-white text-[9px] font-bold rounded-full flex items-center justify-center shadow z-20">
                            ${remainingTrees.length}
                        </div>
                        ${moreDanger ? `<div class="absolute -top-1 -left-1 w-3 h-3 bg-red-500 border border-white rounded-full animate-bounce z-20"></div>` : ''}
                    </div>`;

                    const moreIcon = L.divIcon({ html: moreHtml, className: '', iconSize: [40, 40], iconAnchor: [20, 20] });
                    const moreMarker = L.marker(moreLatLng, { icon: moreIcon, zIndexOffset: depthZOffset });
                    moreMarker.on('click', (e: any) => {
                        L.DomEvent.stopPropagation(e);
                        // Push new level: remaining trees become the next center + petals
                        setExpansionStack(prev => [...prev, {
                            clusterId: prev[0].clusterId,
                            trees: remainingTrees,
                            lat: topLevel.lat,
                            lng: topLevel.lng
                        }]);
                    });
                    moreMarker.addTo(nextLayer);
                    nextMarkerCount += 1;
                }

            } else {
                // COLLAPSED CLUSTER — pie of the member trees' images; grows on hover.
                const clusterTrees = [cluster.center, ...cluster.children];
                const hasDanger = clusterTrees.some(t => t.status === 'DANGER');
                const html = `
                <div class="relative w-16 h-16 group cursor-pointer transition-transform duration-300 hover:scale-150 hover:z-[400]" style="transform-origin:center;">
                    <div class="absolute inset-0 drop-shadow-xl">
                        ${getClusterPieHtml(clusterTrees, cluster.id)}
                    </div>
                    <div class="absolute -top-1 -right-1 w-6 h-6 bg-emerald-600 border-2 border-white text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-md z-20">
                        ${count}
                    </div>
                    ${hasDanger ? `<div class="absolute -top-1 -left-1 w-3.5 h-3.5 bg-red-500 border-2 border-white rounded-full animate-bounce z-20"></div>` : ''}
                </div>`;

                const icon = L.divIcon({ html, className: '', iconSize: [64, 64], iconAnchor: [32, 32] });
                const marker = L.marker([cluster.lat, cluster.lng], { icon });
                marker.on('click', (e: any) => {
                    L.DomEvent.stopPropagation(e);
                    map.setView([cluster.lat, cluster.lng], map.getZoom(), { animate: true });
                    // Push first level: all trees in this cluster
                    setExpansionStack([{
                        clusterId: cluster.id,
                        trees: [cluster.center, ...cluster.children],
                        lat: cluster.lat,
                        lng: cluster.lng
                    }]);
                });
                marker.addTo(nextLayer);
                nextMarkerCount += 1;
            }
        });

        if (nextMarkerCount > 0 || visibleTreeCount === 0) {
            map.removeLayer(markersLayer.current);
            markersLayer.current = nextLayer.addTo(map);
            setMarkerCount(prev => prev === nextMarkerCount ? prev : nextMarkerCount);
        } else {
            setMarkerCount(prev => prev === 0 ? prev : 0);
        }
    }

    updateMarkersRef.current = updateMarkers;

    useEffect(() => {
        return () => {
            if (mapInstance.current) {
                mapInstance.current.remove();
                mapInstance.current = null;
            }
        };
    }, []);

    return (
        <>
            <style>{`
                @keyframes pop-in {
                    0% { transform: scale(0); opacity: 0; }
                    70% { transform: scale(1.1); opacity: 1; }
                    100% { transform: scale(1); opacity: 1; }
                }
                .marker-pop {
                    animation: pop-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
                    opacity: 0;
                }
                .leaflet-popup.forest-popup-below .leaflet-popup-content-wrapper {
                    margin-top: 14px;
                }
                .leaflet-popup.forest-popup-below .leaflet-popup-tip-container {
                    position: absolute;
                    top: 0;
                    bottom: auto;
                    left: 50%;
                    margin-top: 0;
                    transform: translate(-50%, -50%) rotate(180deg);
                }
            `}</style>
            <div className="relative">
                <div ref={mapContainer} style={{ width: '100%', height: 'calc(100vh - 230px)', minHeight: '400px', zIndex: 1 }} className="w-full rounded-xl shadow-inner border border-slate-700 bg-slate-900" />
                {onRefresh && (
                    <button
                        onClick={() => {
                            // Re-frame the primary lifetree (the default 100 km view), then reload the forest.
                            const L = (window as any).L;
                            const coords = primaryTree ? getTreeCoordinates(primaryTree) : null;
                            if (L && mapInstance.current && coords) {
                                mapInstance.current.fitBounds(L.latLng(coords.lat, coords.lng).toBounds(200000), { animate: true });
                            }
                            onRefresh();
                        }}
                        disabled={loading}
                        title="Refresh forest"
                        aria-label="Refresh forest"
                        className="absolute top-3 right-3 z-30 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-lg ring-1 ring-slate-200 transition-all hover:bg-white hover:text-emerald-600 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Icons.Refresh />
                    </button>
                )}
                {(loading || (isMapReady && visibleTreeCount > 0 && markerCount === 0)) && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-slate-950/30 backdrop-blur-[2px]">
                        <div className="flex flex-col items-center gap-3 rounded-2xl bg-white/90 px-6 py-5 shadow-lg">
                            <Loading />
                            <span className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-700">{loading ? 'Loading Forest' : 'Rendering Trees'}</span>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};
