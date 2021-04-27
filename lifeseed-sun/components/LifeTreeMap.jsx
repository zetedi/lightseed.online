import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import L, { Point } from 'leaflet';
import 'leaflet/dist/leaflet.css';

function createLifeTreeMarkers(lifeTrees) {
  return lifeTrees.map((lifeTree) => {
    const r = {};
    r.lifeTreeData = lifeTree;
    r.lifeTreeIcon = L.icon({
      iconUrl: lifeTree?.image ? lifeTree?.image : '/static/lifeseed.svg',
      iconSize: new Point(70),
      className: 'leaflet-div-icon',
    });
    console.log(r);
    return r;
  });
}

const LifeTreeMap = ({ lifeTrees }) => (
  <MapContainer
    center={[51.505, -0.09]}
    zoom={13}
    scrollWheelZoom
    style={{ height: '79vh', width: '100%', opacity: 1 }}
  >
    <TileLayer
      attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
    />
    {createLifeTreeMarkers(lifeTrees).map((lifeTree) => (
      <Marker
        position={[
          lifeTree?.lifeTreeData?.latitude,
          lifeTree?.lifeTreeData?.longitude,
        ]}
        icon={lifeTree?.lifeTreeIcon}
        opacity="1"
      >
        <Popup>
          <img width="250px" src={lifeTree?.lifeTreeData?.image} />
        </Popup>
      </Marker>
    ))}
  </MapContainer>
);

export default LifeTreeMap;
