
import React, { useRef, useEffect, useState } from 'react';
import { type Lifetree } from '../types';
import { isExplicitlyValidatedTree } from '../utils/validation';
import { Loading } from './ui/Loading';

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

export const ForestMap = ({ trees, onView, loading = false }: { trees: Lifetree[], onView: (tree: Lifetree) => void, loading?: boolean }) => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<any>(null);
    const markersLayer = useRef<any>(null);

    const [expansionStack, setExpansionStack] = useState<StackLevel[]>([]);

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

        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
            maxZoom: 19
        }).addTo(mapInstance.current);

        L.control.zoom({ position: 'bottomright' }).addTo(mapInstance.current);
        markersLayer.current = L.layerGroup().addTo(mapInstance.current);

        mapInstance.current.on('zoomend', () => {
            setExpansionStack([]);
            updateMarkers(L);
        });

        // Click on map background collapses everything
        mapInstance.current.on('click', () => {
            setExpansionStack([]);
        });

        setTimeout(() => {
            mapInstance.current?.invalidateSize();
            updateMarkers(L);
        }, 250);
    }

    useEffect(() => {
        const L = (window as any).L;
        if (!L || !mapInstance.current) return;
        setTimeout(() => {
            mapInstance.current?.invalidateSize();
            updateMarkers(L);
        }, 50);
    }, [trees, expansionStack, loading]);

    const getHtmlForTree = (tree: Lifetree, isSmall = false, delay = 0) => {
        const isNature = tree.isNature;
        const isDanger = tree.status === 'DANGER';
        const guardianCount = tree.guardians ? tree.guardians.length : 0;
        const sizeClass = isSmall ? 'w-10 h-10' : 'w-12 h-12';
        const borderClass = isSmall ? 'border' : 'border-2';
        const displayImage = tree.latestGrowthUrl || tree.imageUrl || 'https://via.placeholder.com/150';
        const imgStyle = "width: 100%; height: 100%; object-fit: cover; display: block;";
        const animStyle = `animation-delay: ${delay}ms;`;

        if (isNature) {
            return `
            <div class="marker-pop relative ${sizeClass} hover:scale-110 transition-transform duration-300 group" style="${animStyle}">
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
            <div class="absolute inset-0 bg-emerald-500 rounded-full animate-ping opacity-20"></div>
            <div class="relative ${sizeClass} rounded-full ${borderClass} border-white shadow-xl overflow-hidden bg-white">
                <img src="${displayImage}" style="${imgStyle}" class="w-full h-full object-cover" />
            </div>
            ${isExplicitlyValidatedTree(tree) ? '<div class="absolute -top-2 -right-2 rounded-full border border-emerald-200 bg-white/95 px-1.5 py-0.5 text-[8px] font-black tracking-[0.2em] text-yellow-400 shadow-sm">V<span class="ml-0.5 text-[6px] font-bold tracking-[0.12em] text-emerald-700">validated</span></div>' : ''}
            ${isDanger ? `<div class="absolute -top-1 -left-1 z-20 w-3 h-3 bg-red-500 border border-white rounded-full animate-bounce"></div>` : ''}
        </div>`;
    }

    const createPopupContent = (tree: Lifetree) => {
        const displayImage = tree.latestGrowthUrl || tree.imageUrl;
        const div = document.createElement('div');
        div.innerHTML = `
            <div class="text-center min-w-[160px]">
                ${displayImage ? `<img src="${displayImage}" style="width:100%;height:120px;object-fit:cover;display:block;" class="rounded-t-lg" />` : ''}
                <div class="p-2">
                    <h3 class="font-bold text-sm text-slate-800 mb-1">${tree.name}</h3>
                    <p class="text-xs text-slate-500 line-clamp-2 italic mb-2">"${tree.body}"</p>
                    <button class="view-btn bg-emerald-600 text-white text-xs font-bold px-4 py-1.5 rounded-full w-full">View Tree</button>
                </div>
            </div>
        `;
        div.querySelector('.view-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            onView(tree);
        });
        return div;
    }

    const updateMarkers = (L: any) => {
        if (!markersLayer.current || !mapInstance.current) return;
        markersLayer.current.clearLayers();

        const CLUSTER_THRESHOLD_PX = 50;
        const clusters: Cluster[] = [];
        const processed = new Set<string>();
        const map = mapInstance.current;

        const sortedTrees = [...trees].sort((a, b) =>
            (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)
        );

        sortedTrees.forEach(tree => {
            if (processed.has(tree.id)) return;
            const lat = tree.latitude || (tree as any).lat;
            const lng = tree.longitude || (tree as any).lng;
            if (!lat || !lng) return;

            const treePoint = map.latLngToLayerPoint([lat, lng]);
            const cluster: Cluster = { id: tree.id, center: tree, children: [], lat, lng };
            processed.add(tree.id);

            sortedTrees.forEach(other => {
                if (processed.has(other.id)) return;
                const oLat = other.latitude || (other as any).lat;
                const oLng = other.longitude || (other as any).lng;
                if (!oLat || !oLng) return;
                const otherPoint = map.latLngToLayerPoint([oLat, oLng]);
                if (treePoint.distanceTo(otherPoint) < CLUSTER_THRESHOLD_PX) {
                    cluster.children.push(other);
                    processed.add(other.id);
                }
            });

            clusters.push(cluster);
        });

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
                 .addTo(markersLayer.current)
                 .bindPopup(createPopupContent(cluster.center));

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
                 .addTo(markersLayer.current);

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
                xMarker.addTo(markersLayer.current);

                // Center tree
                const centerIcon = L.divIcon({
                    html: getHtmlForTree(centerTree, false, 0),
                    className: '',
                    iconSize: [48, 48],
                    iconAnchor: [24, 24]
                });
                L.marker([topLevel.lat, topLevel.lng], { icon: centerIcon, zIndexOffset: depthZOffset })
                 .addTo(markersLayer.current)
                 .bindPopup(createPopupContent(centerTree));

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
                    }).addTo(markersLayer.current);

                    const childIcon = L.divIcon({
                        html: getHtmlForTree(child, true, (index + 1) * 50),
                        className: '',
                        iconSize: [40, 40],
                        iconAnchor: [20, 20],
                        popupAnchor: [0, -20]
                    });
                    L.marker(childLatLng, { icon: childIcon, zIndexOffset: depthZOffset })
                     .addTo(markersLayer.current)
                     .bindPopup(createPopupContent(child));
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
                    }).addTo(markersLayer.current);

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
                    moreMarker.addTo(markersLayer.current);
                }

            } else {
                // COLLAPSED CLUSTER (Logo)
                const hasDanger = [cluster.center, ...cluster.children].some(t => t.status === 'DANGER');
                const html = `
                <div class="relative w-16 h-16 group cursor-pointer hover:scale-110 transition-transform duration-300">
                    <div class="absolute inset-0 drop-shadow-xl">
                        ${logoSvg}
                    </div>
                    <div class="absolute top-0 right-0 w-6 h-6 bg-emerald-600 border-2 border-white text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-md z-20">
                        ${count}
                    </div>
                    ${hasDanger ? `<div class="absolute top-0 left-0 w-3.5 h-3.5 bg-red-500 border-2 border-white rounded-full animate-bounce z-20"></div>` : ''}
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
                marker.addTo(markersLayer.current);
            }
        });
    }

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
            `}</style>
            <div className="relative">
                <div ref={mapContainer} style={{ width: '100%', height: '60vh', minHeight: '400px', zIndex: 1 }} className="w-full rounded-xl shadow-inner border border-slate-700 bg-slate-900" />
                {loading && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-slate-950/30 backdrop-blur-[2px]">
                        <div className="flex flex-col items-center gap-3 rounded-2xl bg-white/90 px-6 py-5 shadow-lg">
                            <Loading />
                            <span className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-700">Loading Forest</span>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};
