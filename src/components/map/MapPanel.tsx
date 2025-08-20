import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import type { MapContainerProps, TileLayerProps, CircleMarkerProps } from "react-leaflet";
import type { LatLngTuple } from "leaflet";
import "leaflet/dist/leaflet.css";

import type { Tree } from "../../types/Types";
import { useEffect } from "react";

function FitOnce({ trees }: { trees: Tree[] }) {
  const map = useMap();

  useEffect(() => {
    if (!trees.length) return;

    // only accept valid numeric coords
    const latlngs: LatLngTuple[] = trees
      .filter(t => Number.isFinite(t.lat) && Number.isFinite(t.lng))
      .map(t => [t.lat, t.lng] as LatLngTuple);

    if (!latlngs.length) return;

    if (latlngs.length === 1) {
      map.setView(latlngs[0], 6);
    } else {
      map.fitBounds(latlngs, { padding: [30, 30] });
    }
  }, [trees, map]);

  return null;
}

export default function MapPanel({
  trees,
  onOpenAddTree,
}: {
  trees: Tree[];
  onOpenAddTree: () => void;
}) {
  const mapProps: MapContainerProps = {
    center: [20, 0] as LatLngTuple,
    zoom: 2,
    scrollWheelZoom: true,
    // You can add more: worldCopyJump, minZoom, etc.
  };

  const tileProps: TileLayerProps = {
    url: "https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png",
    // Leaflet option name is 'attribution'; React-Leaflet forwards it correctly.
    attribution: "© OpenStreetMap contributors",
    subdomains: ["a", "b", "c"],
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-base text-muted">Map & Trees</h2>
        <button className="btn btn-primary" onClick={onOpenAddTree}>+ Add Tree</button>
      </div>

      {/* Important: give the map a height via className or style */}
      <MapContainer {...mapProps} className="h-[400px] w-full rounded-lg overflow-hidden">
        <TileLayer {...tileProps} />
        <FitOnce trees={trees} />

        {trees.map(t => {
          const center = [t.lat, t.lng] as LatLngTuple;
          const circleProps: CircleMarkerProps = {
            center,
            radius: 8,
            pathOptions: { color: t.color, fillColor: t.color, fillOpacity: 0.85 },
          };
          return (
            <CircleMarker key={t.id} {...circleProps}>
              <Popup>
                <div className="text-sm">
                  <strong>{t.name}</strong><br />
                  <span className="opacity-80">{t.note || ""}</span>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}