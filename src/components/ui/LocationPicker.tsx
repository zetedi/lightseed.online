import React, { useEffect, useRef } from 'react';

interface LocationPickerProps {
  value: { latitude: number; longitude: number } | null;
  onChange: (coords: { latitude: number; longitude: number }) => void;
  className?: string;
}

// A small interactive Leaflet map for picking a tree's coordinates. Reuses the
// globally-loaded Leaflet (window.L), the same as ForestMap. Tap the map to set
// the location; it also follows external updates (e.g. the "Locate" button / GPS).
export const LocationPicker: React.FC<LocationPickerProps> = ({ value, onChange, className }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const onChangeRef = useRef(onChange);
  // Keep the latest onChange for the map click handler without re-binding Leaflet listeners.
  useEffect(() => { onChangeRef.current = onChange; });

  useEffect(() => {
    let cancelled = false;

    const place = (L: any, lat: number, lng: number) => {
      if (markerRef.current) markerRef.current.setLatLng([lat, lng]);
      else markerRef.current = L.marker([lat, lng]).addTo(mapRef.current);
    };

    const init = () => {
      const L = (window as any).L;
      if (cancelled) return;
      if (!L || !containerRef.current) { window.setTimeout(init, 150); return; }
      if (mapRef.current) return;

      const start: [number, number] = value ? [value.latitude, value.longitude] : [20, 0];
      const map = L.map(containerRef.current, { zoomControl: true, attributionControl: false }).setView(start, value ? 13 : 2);
      mapRef.current = map;

      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 }).addTo(map);

      if (value) place(L, value.latitude, value.longitude);

      map.on('click', (e: any) => {
        const { lat, lng } = e.latlng;
        place(L, lat, lng);
        onChangeRef.current({ latitude: lat, longitude: lng });
      });

      window.setTimeout(() => map.invalidateSize(), 200);
    };

    init();

    return () => {
      cancelled = true;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; markerRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only Leaflet init; `value` only seeds the start view, and depending on it would tear down/recreate the map on every pick
  }, []);

  // Follow external coordinate changes (Locate button, GPS, image EXIF).
  useEffect(() => {
    const L = (window as any).L;
    const map = mapRef.current;
    if (!L || !map || !value) return;
    if (markerRef.current) markerRef.current.setLatLng([value.latitude, value.longitude]);
    else markerRef.current = L.marker([value.latitude, value.longitude]).addTo(map);
    map.setView([value.latitude, value.longitude], Math.max(map.getZoom() || 0, 13));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on primitive coords; the `value` object gets a new identity each parent render and would re-run setView needlessly
  }, [value?.latitude, value?.longitude]);

  return (
    <div
      ref={containerRef}
      className={className || 'h-48 w-full rounded-xl overflow-hidden border border-white/20 shadow-inner'}
      style={{ zIndex: 1 }}
    />
  );
};
