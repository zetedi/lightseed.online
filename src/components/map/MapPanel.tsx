import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import type { Tree } from "../../types/Types";
import { useEffect } from "react";

function FitOnce({ trees }: { trees: Tree[] }) {
  const map = useMap();
  useEffect(() => {
    if (!trees.length) return;
    const latlngs = trees.map(t => [t.lat, t.lng]) as [number, number][];
    if (latlngs.length === 1) map.setView(latlngs[0], 6);
    else map.fitBounds(latlngs, { padding: [30, 30] });
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
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-base text-muted">Map & Trees</h2>
        <button className="btn btn-primary" onClick={onOpenAddTree}>+ Add Tree</button>
      </div>

      <MapContainer id="map" center={[20, 0]} zoom={2} scrollWheelZoom>
        <TileLayer
          attribution="© OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png"
          subdomains={['a','b','c']}
        />
        <FitOnce trees={trees} />
        {trees.map(t => (
          <CircleMarker
            key={t.id}
            center={[t.lat, t.lng]}
            radius={8}
            pathOptions={{ color: t.color, fillColor: t.color, fillOpacity: 0.85 }}
          >
            <Popup>
              <div className="text-sm">
                <strong>{t.name}</strong><br/>
                <span className="opacity-80">{t.note || ""}</span>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
