import React, { useState, useEffect, useRef } from 'react';
import Modal from './Modal';
import { AppUser, Lifetree } from '../types';
import { saveLifetree, fetchUserLifetree, updateLifetree } from '../services/firebase';
import { GeoPoint } from 'firebase/firestore';
import { Spinner } from './Icons';

interface SaveLifetreeModalProps {
  user: AppUser;
  onClose: () => void;
}

const SaveLifetreeModal: React.FC<SaveLifetreeModalProps> = ({ user, onClose }) => {
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [location, setLocation] = useState<GeoPoint | null>(null);
  const [existingLifetree, setExistingLifetree] = useState<Lifetree | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mapRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);

  useEffect(() => {
    const getUserLifetree = async () => {
      setIsLoading(true);
      const tree = await fetchUserLifetree(user.uid);
      if (tree) {
        setExistingLifetree(tree);
        setName(tree.name);
        setBody(tree.body);
        setLocation(tree.location);
      }
      setIsLoading(false);
    };
    getUserLifetree();
  }, [user.uid]);

  useEffect(() => {
    if (mapRef.current && window.google && !isLoading) {
      const initialCenter = location 
        ? { lat: location.latitude, lng: location.longitude }
        : { lat: 0, lng: 0 };
      
      const map = new window.google.maps.Map(mapRef.current, {
        center: initialCenter,
        zoom: location ? 8 : 2,
      });

      if (location) {
        markerRef.current = new window.google.maps.Marker({
          position: initialCenter,
          map: map,
          draggable: true,
        });
      }

      map.addListener('click', (e: google.maps.MapMouseEvent) => {
        if (e.latLng) {
            const newLocation = new GeoPoint(e.latLng.lat(), e.latLng.lng());
            setLocation(newLocation);
            if (!markerRef.current) {
                markerRef.current = new window.google.maps.Marker({
                    position: e.latLng,
                    map: map,
                    draggable: true,
                });
            } else {
                markerRef.current.setPosition(e.latLng);
            }
        }
      });
    }
  }, [mapRef, isLoading, location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !body || !location) {
      setError('Please fill out all fields and select a location on the map.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      if (existingLifetree) {
        await updateLifetree(existingLifetree.id, { name, body, location });
      } else {
        await saveLifetree({
          name,
          body,
          location,
          authorId: user.uid,
          authorName: user.displayName || 'Anonymous',
        });
      }
      onClose();
    } catch (err) {
      console.error(err);
      setError('Failed to save your Lifetree. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if(isLoading) {
    return (
        <Modal title="My Lifetree" onClose={onClose}>
            <div className="flex justify-center items-center h-48">
                <Spinner />
            </div>
        </Modal>
    );
  }

  return (
    <Modal title={existingLifetree ? "Edit Your Lifetree" : "Create Your Lifetree"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-slate-600">
          {existingLifetree 
            ? "Update the details of your personal Lifetree."
            : "Plant your Lifetree on the map. This represents your story's origin or a special place."
          }
        </p>
        <div>
          <label htmlFor="lifetree-name" className="block text-sm font-medium text-slate-700">Name</label>
          <input
            type="text"
            id="lifetree-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
            placeholder="e.g., The Old Oak of Hometown"
            disabled={isSubmitting}
          />
        </div>
        <div>
          <label htmlFor="lifetree-body" className="block text-sm font-medium text-slate-700">Short Bio / Story</label>
          <textarea
            id="lifetree-body"
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
            placeholder="A few words about you or this place..."
            disabled={isSubmitting}
          />
        </div>
        <div>
            <label className="block text-sm font-medium text-slate-700">Location</label>
            <p className="text-xs text-slate-500">Click on the map to set or move your Lifetree's location.</p>
            <div ref={mapRef} style={{ width: '100%', height: '250px', marginTop: '8px' }} className="rounded-md" />
            {location && <p className="text-xs text-slate-500 mt-1">Location selected: {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}</p>}
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSubmitting || !location}
            className="inline-flex justify-center items-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-emerald-700 hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:bg-emerald-400 disabled:cursor-not-allowed"
          >
            {isSubmitting && <Spinner />}
            {isSubmitting ? 'Saving...' : 'Save Lifetree'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default SaveLifetreeModal;
