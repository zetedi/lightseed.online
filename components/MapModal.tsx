import React, { useEffect, useRef, useState } from 'react';
import Modal from './Modal';
import { fetchLifetrees } from '../services/firebase';
import { Lifetree } from '../types';

const MapModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [lifetrees, setLifetrees] = useState<Lifetree[]>([]);
  const [map, setMap] = useState<google.maps.Map | null>(null);

  useEffect(() => {
    const getLifetrees = async () => {
      const data = await fetchLifetrees();
      setLifetrees(data);
    };
    getLifetrees();
  }, []);

  useEffect(() => {
    if (mapRef.current && window.google && !map) {
      const newMap = new window.google.maps.Map(mapRef.current, {
        center: { lat: 0, lng: 0 },
        zoom: 2,
      });
      setMap(newMap);
    }
  }, [mapRef, map]);

  useEffect(() => {
    if (map && lifetrees.length > 0) {
        lifetrees.forEach(tree => {
            new window.google.maps.Marker({
                position: { lat: tree.location.latitude, lng: tree.location.longitude },
                map: map,
                title: tree.name,
            });
        });
    }
  }, [map, lifetrees]);
  
  return (
    <Modal title="Lifetree Map" onClose={onClose}>
      <div ref={mapRef} style={{ width: '100%', height: '60vh' }} />
    </Modal>
  );
};

export default MapModal;
