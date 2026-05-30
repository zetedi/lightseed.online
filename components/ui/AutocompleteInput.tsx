
import React, { useState, useEffect, useRef } from 'react';
import { Organisation } from '../../types';
import { fetchOrganisations } from '../../services/firebase';
import { Icons } from './Icons';

interface AutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export const AutocompleteInput: React.FC<AutocompleteInputProps> = ({ value, onChange, placeholder, className }) => {
  const [orgs, setOrgs] = useState<Organisation[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchOrganisations().then(setOrgs);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setShowSuggestions(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = orgs.filter(o => 
    o.domain.toLowerCase().includes(value.toLowerCase()) || 
    o.name.toLowerCase().includes(value.toLowerCase())
  ).slice(0, 5);

  return (
    <div ref={ref} className="relative w-full">
      <input 
        type="text" 
        value={value} 
        onChange={e => { onChange(e.target.value); setShowSuggestions(true); }}
        onFocus={() => setShowSuggestions(true)}
        placeholder={placeholder} 
        className={className} 
      />
      {showSuggestions && value && filtered.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          {filtered.map(org => (
            <button
              key={org.id}
              type="button"
              onClick={() => { onChange(org.domain); setShowSuggestions(false); }}
              className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center justify-between border-b border-slate-50 last:border-b-0"
            >
              <div>
                <p className="text-sm font-bold text-slate-800">{org.name}</p>
                <p className="text-xs text-slate-400 font-mono">{org.domain}</p>
              </div>
              <Icons.ChevronRight size={16} className="text-slate-300" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
