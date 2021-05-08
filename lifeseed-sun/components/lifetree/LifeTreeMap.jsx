import Head from 'next/head';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import L, { Point } from 'leaflet';
import 'leaflet/dist/leaflet.css';

export default function LifetreeMap({ lifetrees }) {
  const lifetreeMarkers = lifetrees.map((lifetree) => {
    const r = {};
    r.lifetreeData = lifetree;
    r.lifetreeIcon = L.icon({
      iconUrl: lifetree?.image ? lifetree?.image : '/static/lifeseed.svg',
      iconSize: new Point(70),
      className: 'leaflet-div-icon',
    });
    return r;
  });
  return (
    <>
      <Head>
        <title>Lifetree map</title>
      </Head>
      <MapContainer
        center={[46.006502, 4.494195]}
        zoom={7}
        scrollWheelZoom
        style={{ height: '79vh', width: '100%', opacity: 1 }}
      >
        <TileLayer
          url="https://api.mapbox.com/styles/v1/zetedi/cko2rvlqq0q6u19n9hkotfdry/tiles/256/{z}/{x}/{y}@2x?access_token=pk.eyJ1IjoiemV0ZWRpIiwiYSI6ImNrbzA5Nmo5ZTA5MWUyd253dXRqcXdoMzgifQ.ivQr0qeW6C1kDwBDyTE6TQ"
          attribution='Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery &copy; <a href="https://www.mapbox.com/">Mapbox</a>'
        />
        {lifetreeMarkers.map((lifetree) => (
          <Marker
            position={[
              lifetree?.lifetreeData?.latitude,
              lifetree?.lifetreeData?.longitude,
            ]}
            icon={lifetree?.lifetreeIcon}
            t
            opacity="1"
            key={lifetree?.lifetreeData?.id}
          >
            <Popup>
              <img width="250px" src={lifetree?.lifetreeData?.image} />
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </>
  );
}
