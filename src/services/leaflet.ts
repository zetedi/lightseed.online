// Leaflet, bundled and lazy. One dynamic import → its own chunk, loaded the first time a map
// actually renders: no render-blocking unpkg <script> on every page, no window.L polling, and
// the PWA precaches it so maps initialize offline (tiles still need the network).
import type * as Leaflet from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

export type LeafletModule = typeof Leaflet;

let loader: Promise<LeafletModule> | null = null;

export const loadLeaflet = (): Promise<LeafletModule> => {
    if (!loader) {
        loader = Promise.all([
            import('leaflet'),
            import('leaflet/dist/leaflet.css'),
        ]).then(([mod]) => {
            const L = (mod as any).default ?? mod;
            // Under a bundler Leaflet can't derive its default marker image URLs from the
            // stylesheet path — point them at the hashed assets Vite emits.
            delete (L.Icon.Default.prototype as any)._getIconUrl;
            L.Icon.Default.mergeOptions({
                iconRetinaUrl: markerIcon2x,
                iconUrl: markerIcon,
                shadowUrl: markerShadow,
            });
            return L as LeafletModule;
        });
    }
    return loader;
};
