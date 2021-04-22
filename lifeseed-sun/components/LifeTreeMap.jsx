import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import L, { Point, DivIcon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Avatar,
  Box,
  Button,
  Grid,
  Input,
  LinearProgress,
  Card,
  CardActions,
  CardContent,
  Typography,
  TextField,
} from '@material-ui/core';

const icon = L.icon({
  iconUrl: '/static/lifeseed.svg',
  iconSize: new Point(70, 70),
  className: 'leaflet-div-icon',
});

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
    {lifeTrees.map((lifeTree) => (
      <Marker position={[lifeTree.latitude, lifeTree.longitude]} icon={icon}>
        <Avatar aria-label="lifeTree">
          <img
            src={lifeTree?.photo?.image?.publicUrlTransformed}
            alt={lifeTree?.photo?.altText}
          />
        </Avatar>
        <Popup>
          <img
            width="100px"
            src={lifeTree?.photo?.image?.publicUrlTransformed}
            alt={lifeTree?.photo?.altText}
          />
        </Popup>
      </Marker>
    ))}
  </MapContainer>
);

export default LifeTreeMap;
