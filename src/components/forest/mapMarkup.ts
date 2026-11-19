import type { Lifetree } from '../../types';
import type { LightHouse } from '../../domain/lightHouse';
import type { TranslationKey } from '../../utils/translations';
import { isExplicitlyValidatedTree } from '../../utils/validation';
import { escapeHtml, safeImageUrl, DARK_IMAGE_FALLBACK } from '../../utils/sanitize';
import { imageVariantUrlOf } from '../../domain/imageVariant';
import { isWateringOverdue } from '../../domain/watering';

// THE MAP'S MARKUP — Leaflet takes strings and DOM nodes where a React component cannot go, so
// every marker, cluster and popup the forest map draws is built here, apart from the map's own
// life (ForestMap). The one law of this file: nothing stored reaches the page unescaped — every
// word passes escapeHtml, every address safeImageUrl (tests/outwardLinks holds the door).
type T = (key: TranslationKey) => string;

// A lightHouse rides the map as a being like any other — this pseudo-tree shape lets it join
// the same clustering, petal expansion and popup plumbing the trees use.
export type MapBeing = Lifetree & { __lightHouse?: LightHouse };

// One opened level of a cluster: the center and what petals around it.
export interface StackLevel {
    clusterId: string;  // ID of the root cluster (for matching which cluster is open)
    trees: Lifetree[];  // [center, ...petals, ...remaining]
    lat: number;
    lng: number;
}

// A seat in marker HTML: the 480 variant in src, the primary a step behind it in data-primary.
// The map container's capture-phase error listener swaps the primary in when the variant is
// not (yet) there. Both pass safeImageUrl — attribute-safe, http(s) or / only.
export const seatAttrs = (url: string | null | undefined, fallback = ''): string => {
    const primary = safeImageUrl(url, fallback);
    const variant = safeImageUrl(imageVariantUrlOf(url, 480), fallback);
    return `src="${variant}" data-primary="${primary}"`;
};

// One being's marker: a Light House in its glow, a nature tree with its guardian count, a
// lifetree with its validation mark (and a secret tree's key).
export const markerHtml = (tree: Lifetree, t: T, guardianCount: number, isSmall = false, delay = 0): string => {
    const sanct = (tree as MapBeing).__lightHouse;
    if (sanct) {
        const size = isSmall ? 'w-10 h-10' : 'w-12 h-12';
        const img = seatAttrs(sanct.imageUrl || '/lighthouse.webp', DARK_IMAGE_FALLBACK);
        return `
        <div class="marker-pop relative ${size} hover:scale-110 transition-transform duration-300" style="animation-delay: ${delay}ms;" role="button" aria-label="${escapeHtml(sanct.name)}, ${escapeHtml(t('light_house'))}">
            <div class="lightHouse-glow absolute -inset-4 rounded-full"></div>
            <div class="absolute -inset-1 rounded-full border-2 border-yellow-300/90"></div>
            <div class="relative ${size} rounded-full border-2 border-amber-400 overflow-hidden bg-[#04070f] shadow-xl z-10">
                <img ${img} style="width:100%;height:100%;object-fit:cover;display:block;" />
            </div>
        </div>`;
    }
    const isNature = tree.isNature;
    const isDanger = tree.status === 'DANGER';
    const sizeClass = isSmall ? 'w-10 h-10' : 'w-12 h-12';
    const borderClass = isSmall ? 'border' : 'border-2';
    // A tree with no face yet shows as a seed — planted, waiting to grow.
    const displayImage = seatAttrs(tree.latestGrowthUrl || tree.imageUrl || (tree.id === 'GENESIS_TREE' ? '/mahameru.svg' : '/seed.webp'), DARK_IMAGE_FALLBACK);
    const imgStyle = "width: 100%; height: 100%; object-fit: cover; display: block;";
    const animStyle = `animation-delay: ${delay}ms;`;

    const ariaName = escapeHtml(tree.name || t('type_lifetree'));

    if (isNature) {
        return `
        <div class="marker-pop relative ${sizeClass} hover:scale-110 transition-transform duration-300 group" style="${animStyle}" role="button" aria-label="${ariaName}">
            ${isWateringOverdue(tree) ? '<div class="absolute -inset-1 rounded-full border-2 border-sky-400 animate-pulse z-20"></div>' : ''}
            <div class="absolute inset-0 bg-sky-500 rounded-full animate-pulse opacity-20"></div>
            <div class="relative ${sizeClass} rounded-full ${borderClass} border-white shadow-xl overflow-hidden bg-white z-10 dark:bg-slate-900">
                <img ${displayImage} style="${imgStyle}" class="w-full h-full object-cover" />
            </div>
            <div class="absolute -top-1 -right-1 z-20 w-4 h-4 bg-sky-500 border border-white rounded-full flex items-center justify-center text-[8px] text-white font-bold shadow-md">
                ${guardianCount}
            </div>
            ${isDanger ? `<div class="absolute -top-1 -left-1 z-20 w-3 h-3 bg-red-500 border border-white rounded-full animate-bounce"></div>` : ''}
        </div>`;
    }

    // A secret tree wears a violet glow and a small key (domain/secretTree) — seen only by its circle.
    const secret = tree.treeType === 'SECRET';
    const secretKey = secret
        ? `<div class="absolute -top-1.5 -right-1.5 z-20 flex h-5 w-5 items-center justify-center rounded-full border border-white bg-violet-600 text-white shadow-md" title="${escapeHtml(t('secret_tree_visibility'))}"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width:11px;height:11px"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z"/></svg></div>`
        : '';
    return `
    <div class="marker-pop relative ${sizeClass} hover:scale-110 transition-transform duration-300" style="${animStyle}" role="button" aria-label="${ariaName}${secret ? ', ' + escapeHtml(t('type_secret')) : ''}">
        ${isWateringOverdue(tree) ? '<div class="absolute -inset-1 rounded-full border-2 border-sky-400 animate-pulse z-20"></div>' : ''}
        <div class="absolute inset-0 ${secret ? 'bg-violet-500' : 'bg-emerald-500'} rounded-full animate-ping opacity-20"></div>
        <div class="relative ${sizeClass} rounded-full ${borderClass} border-white shadow-xl overflow-hidden bg-white dark:bg-slate-900">
            <img ${displayImage} style="${imgStyle}" class="w-full h-full object-cover" />
        </div>
        ${isExplicitlyValidatedTree(tree) ? '<div class="absolute -top-1.5 -right-1.5 z-20 flex h-5 w-5 items-center justify-center rounded-full border border-white bg-emerald-600 text-[10px] font-black leading-none text-yellow-300 shadow-md" title="' + escapeHtml(t('forest_validated_badge')) + '" aria-label="' + escapeHtml(t('forest_validated_badge')) + '">V</div>' : ''}
        ${isDanger ? `<div class="absolute -top-1 -left-1 z-20 w-3 h-3 bg-red-500 border border-white rounded-full animate-bounce"></div>` : ''}
        ${secretKey}
    </div>`;
};

const clusterPrimaryOf = (tree: Lifetree) => tree.latestGrowthUrl || tree.imageUrl || (tree.id === 'GENESIS_TREE' ? '/mahameru.svg' : '/seed.webp');
const clusterImage = (tree: Lifetree) => safeImageUrl(imageVariantUrlOf(clusterPrimaryOf(tree), 480), DARK_IMAGE_FALLBACK);
const clusterPrimary = (tree: Lifetree) => safeImageUrl(clusterPrimaryOf(tree), DARK_IMAGE_FALLBACK);

// A cluster of nearby trees as a pie of their images (up to 4 slices, rest in the count badge).
export const clusterPieHtml = (trees: Lifetree[], clusterId: string) => {
    const shown = trees.slice(0, 4);
    const k = shown.length;
    const size = 64;
    const cx = size / 2, cy = size / 2, r = size / 2 - 2;
    const safe = clusterId.replace(/[^a-zA-Z0-9]/g, '');

    if (k <= 1) {
        return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><defs><clipPath id="cc${safe}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath></defs><circle cx="${cx}" cy="${cy}" r="${r}" fill="#e2e8f0"/><image href="${clusterImage(shown[0])}" data-primary="${clusterPrimary(shown[0])}" x="0" y="0" width="${size}" height="${size}" preserveAspectRatio="xMidYMid slice" clip-path="url(#cc${safe})"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="white" stroke-width="2"/></svg>`;
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
        body += `<image href="${clusterImage(shown[i])}" data-primary="${clusterPrimary(shown[i])}" x="0" y="0" width="${size}" height="${size}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${id})"/><path d="${path}" fill="none" stroke="white" stroke-width="1.5"/>`;
    }
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><defs>${defs}</defs><circle cx="${cx}" cy="${cy}" r="${r}" fill="#e2e8f0"/>${body}<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="white" stroke-width="2"/></svg>`;
};

// The collapsed cluster as a marker: the pie, how many stand there, and a danger dot.
export const pieClusterHtml = (t: T, trees: Lifetree[], clusterId: string, count: number, danger: boolean): string => {
    const html = `
    <div class="relative w-16 h-16 group cursor-pointer transition-transform duration-300 hover:scale-150 hover:z-[400]" style="transform-origin:center;" role="button" aria-label="${escapeHtml(t('forest_lifetrees_here').replace('{n}', String(count)))}">
        <div class="absolute inset-0 drop-shadow-xl">
            ${clusterPieHtml(trees, clusterId)}
        </div>
        <div class="absolute -top-1 -right-1 w-6 h-6 bg-emerald-600 border-2 border-white text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-md z-20">
            ${count}
        </div>
        ${danger ? `<div class="absolute -top-1 -left-1 w-3.5 h-3.5 bg-red-500 border-2 border-white rounded-full animate-bounce z-20"></div>` : ''}
    </div>`;
    return html;
};

// A collapsed cluster gathered around a Light House: the Light House is the face.
export const lightHouseClusterHtml = (t: T, centerHtml: string, name: string | undefined, count: number, danger: boolean): string => {
    const html = `
    <div class="relative w-12 h-12 group cursor-pointer transition-transform duration-300 hover:scale-125" style="transform-origin:center;" role="button" aria-label="${escapeHtml(t('forest_beings_gather').replace('{name}', name || t('light_house')).replace('{n}', String(count)))}">
        ${centerHtml}
        <div class="absolute -top-1.5 -right-1.5 w-6 h-6 bg-amber-500 border-2 border-white text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-md z-20">
            ${count}
        </div>
        ${danger ? `<div class="absolute -top-1 -left-1 w-3.5 h-3.5 bg-red-500 border-2 border-white rounded-full animate-bounce z-20"></div>` : ''}
    </div>`;
    return html;
};

// The close button above an opened cluster (amber while deeper levels remain beneath it).
export const closeHtml = (t: T, isDeep: boolean): string => {
    const xHtml = `
    <div class="marker-pop flex items-center justify-center w-10 h-10 rounded-full border-2 border-white shadow-lg cursor-pointer hover:scale-110 transition-transform"
         style="background:${isDeep ? '#f59e0b' : '#ef4444'};animation-delay:0ms;" role="button" aria-label="${escapeHtml(t('close'))}">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" style="width:14px;height:14px;">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
    </div>`;
    return xHtml;
};

// The sixth petal when a cluster holds more than fit: the rest, counted.
export const moreNodeHtml = (t: T, n: number, danger: boolean): string => {
    const moreHtml = `
    <div class="marker-pop relative w-10 h-10 cursor-pointer hover:scale-110 transition-transform duration-300" style="animation-delay:${6 * 50}ms;" role="button" aria-label="${escapeHtml(t('forest_more_lifetrees').replace('{n}', String(n)))}">
        <div class="absolute inset-0 drop-shadow-lg">
            <img src="/logo.svg" alt="" style="width:100%;height:100%;display:block;" />
        </div>
        <div class="absolute -top-1 -right-1 w-5 h-5 bg-emerald-600 border-2 border-white text-white text-[9px] font-bold rounded-full flex items-center justify-center shadow z-20">
            ${n}
        </div>
        ${danger ? `<div class="absolute -top-1 -left-1 w-3 h-3 bg-red-500 border border-white rounded-full animate-bounce z-20"></div>` : ''}
    </div>`;
    return moreHtml;
};

// A tree's popup: its face, its words, and the two doors (view, reach).
export const treePopup = (tree: Lifetree, t: T, onView: (tree: Lifetree) => void, onReach?: (tree: Lifetree) => void): HTMLElement => {
    const primaryImage = tree.latestGrowthUrl || tree.imageUrl;
    const displayImage = primaryImage ? seatAttrs(primaryImage) : '';
    const div = document.createElement('div');
    div.innerHTML = `
        <div class="text-center min-w-[160px]">
            ${displayImage ? `<img ${displayImage} style="width:100%;height:120px;object-fit:cover;display:block;" class="rounded-t-lg" />` : ''}
            <div class="p-2">
                <h3 class="font-bold text-sm text-slate-800 mb-1 dark:text-slate-100">${escapeHtml(tree.name)}</h3>
                <p class="text-xs text-slate-500 line-clamp-2 italic mb-2">"${escapeHtml(tree.body)}"</p>
                <div class="grid grid-cols-2 gap-2">
                    <button class="view-btn btn-theme text-white text-xs font-bold px-3 py-2.5 rounded-full w-full">${escapeHtml(t('view'))}</button>
                    <button class="reach-btn bg-amber-500 text-white text-xs font-bold px-3 py-2.5 rounded-full w-full">${escapeHtml(t('reach'))}</button>
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
};

// A Light House's popup.
export const lightHousePopup = (s: LightHouse, t: T, onView?: (s: LightHouse) => void): HTMLElement => {
    const div = document.createElement('div');
    div.innerHTML = `
        <div class="text-center min-w-[170px]">
            ${s.imageUrl ? `<img ${seatAttrs(s.imageUrl)} style="width:100%;height:110px;object-fit:cover;display:block;" class="rounded-t-lg" />` : ''}
            <div class="p-2.5">
                <p class="text-[9px] font-bold uppercase tracking-[0.22em] text-amber-500">${escapeHtml(t('light_house'))}</p>
                <h3 class="font-bold text-sm text-slate-800 mt-0.5 dark:text-slate-100">${escapeHtml(s.name)}</h3>
                ${s.locationName ? `<p class="text-[10px] text-slate-400 mt-0.5">${escapeHtml(s.locationName)}</p>` : ''}
                ${s.body ? `<p class="text-xs text-slate-500 line-clamp-2 italic mt-1">${escapeHtml(s.body)}</p>` : ''}
                <div class="mt-2 grid ${s.splatUrl ? 'grid-cols-2' : 'grid-cols-1'} gap-2">
                    <button class="lightHouse-view-btn btn-theme text-white text-xs font-bold px-3 py-2.5 rounded-full w-full">${escapeHtml(t('view'))}</button>
                    ${s.splatUrl ? `<a href="${safeImageUrl(s.splatUrl)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center justify-center rounded-full bg-amber-500 px-3 py-2.5 text-xs font-bold text-white">${escapeHtml(t('forest_in_3d'))}</a>` : ''}
                </div>
            </div>
        </div>`;
    div.querySelector('.lightHouse-view-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        onView?.(s);
    });
    return div;
};
