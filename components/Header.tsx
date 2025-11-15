import React from 'react';
import { type AppUser } from '../types';
import { signOut } from '../services/firebase';
import { MapIcon, PlusIcon, TreeIcon } from './Icons';

interface HeaderProps {
  user: AppUser | null;
  loading: boolean;
  onLoginClick: () => void;
  onCreatePostClick: () => void;
  onMapClick: () => void;
  onMyLifetreeClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ user, loading, onLoginClick, onCreatePostClick, onMapClick, onMyLifetreeClick }) => {
  
  return (
    <header className="bg-emerald-800 text-white shadow-md">
      <div className="max-w-3xl mx-auto px-4 py-3 flex justify-between items-center">
        <h1 className="text-2xl font-bold font-serif">Lifetree</h1>
        <nav>
          {loading ? (
            <div className="w-24 h-8 bg-emerald-700 rounded animate-pulse"></div>
          ) : user ? (
            <div className="flex items-center space-x-4">
              <button onClick={onCreatePostClick} title="Create Post" className="hover:text-amber-300 transition-colors">
                <PlusIcon className="w-6 h-6" />
              </button>
              <button onClick={onMapClick} title="View Map" className="hover:text-amber-300 transition-colors">
                <MapIcon className="w-6 h-6" />
              </button>
              <button onClick={onMyLifetreeClick} title="My Lifetree" className="hover:text-amber-300 transition-colors">
                <TreeIcon className="w-6 h-6" />
              </button>
              <button onClick={signOut} className="bg-amber-500 hover:bg-amber-600 text-emerald-900 font-semibold px-4 py-2 rounded-full text-sm transition-colors">
                Sign Out
              </button>
            </div>
          ) : (
            <button onClick={onLoginClick} className="bg-amber-500 hover:bg-amber-600 text-emerald-900 font-semibold px-4 py-2 rounded-full text-sm transition-colors">
              Login
            </button>
          )}
        </nav>
      </div>
    </header>
  );
};

export default Header;
