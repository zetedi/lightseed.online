
import React, { useState, useEffect } from 'react';
import { Community } from '../../types';
import { fetchCommunities } from '../../services/firebase';

interface AutocompleteInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const AutocompleteInput: React.FC<AutocompleteInputProps> = ({ label, value, onChange, placeholder }) => {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [filtered, setFiltered] = useState<Community[]>([]);
  const [show, setShow] = useState(false);

  useEffect(() => {
    fetchCommunities().then(setCommunities);
  }, []);

  useEffect(() => {
    if (value) {
      setFiltered(communities.filter(c => c.name.toLowerCase().includes(value.toLowerCase()) || c.domain.toLowerCase().includes(value.toLowerCase())));
    } else {
      setFiltered([]);
    }
  }, [value, communities]);

  return (
    <div className="relative">
      <label className="text-xs font-bold text-slate-400 uppercase ml-1">{label}</label>
      <input 
        type="text" 
        value={value} 
        onChange={e => { onChange(e.target.value); setShow(true); }}
        onFocus={() => setShow(true)}
        className="w-full h-12 bg-slate-50 border border-slate-100 rounded-2xl px-4 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
        placeholder={placeholder}
      />
      {show && filtered.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-slate-100 rounded-2xl shadow-xl overflow-hidden">
          {filtered.map(c => (
            <button 
              key={c.id} 
              type="button"
              onClick={() => { onChange(c.domain); setShow(false); }}
              className="w-full text-left px-4 py-3 hover:bg-emerald-50 flex flex-col"
            >
              <span className="font-bold text-sm text-slate-800">{c.name}</span>
              <span className="text-xs text-slate-500 font-mono">{c.domain}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
