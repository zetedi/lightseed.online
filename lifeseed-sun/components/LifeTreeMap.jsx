import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import L, { Point } from 'leaflet';
import 'leaflet/dist/leaflet.css';

export default function LifeTreeMap({ lifeTrees }) {
  const lifeTreeMarkers = lifeTrees.map((lifeTree) => {
    const r = {};
    r.lifeTreeData = lifeTree;
    r.lifeTreeIcon = L.icon({
      iconUrl: lifeTree?.image ? lifeTree?.image : '/static/lifeseed.svg',
      iconSize: new Point(70),
      className: 'leaflet-div-icon',
    });
    return r;
  });
  return (
    <MapContainer
      center={[51.505, -0.09]}
      zoom={13}
      scrollWheelZoom
      style={{ height: '79vh', width: '100%', opacity: 1 }}
    >
      {/* <TileLayer
        attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      /> */}

      <TileLayer
        url="https://api.mapbox.com/styles/v1/mapbox/streets-v11/tiles/256/{z}/{x}/{y}@2x?access_token=pk.eyJ1IjoiemV0ZWRpIiwiYSI6ImNrbzA5Nmo5ZTA5MWUyd253dXRqcXdoMzgifQ.ivQr0qeW6C1kDwBDyTE6TQ"
        attribution='Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery &copy; <a href="https://www.mapbox.com/">Mapbox</a>'
      />

      {lifeTreeMarkers.map((lifeTree) => (
        <Marker
          position={[
            lifeTree?.lifeTreeData?.latitude,
            lifeTree?.lifeTreeData?.longitude,
          ]}
          icon={lifeTree?.lifeTreeIcon}
          opacity="1"
          key={lifeTree?.lifeTreeData?.id}
        >
          <Popup>
            <img width="250px" src={lifeTree?.lifeTreeData?.image} />
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
