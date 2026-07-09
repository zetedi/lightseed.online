
import React, { useState, useEffect, useMemo } from 'react';
import { Community } from '../../types';
import { fetchCommunities } from '../../services/firebase';

interface AutocompleteInputProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  hint?: string;
}

export const AutocompleteInput: React.FC<AutocompleteInputProps> = ({ label, value, onChange, placeholder, className, hint }) => {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [show, setShow] = useState(false);

  useEffect(() => {
    fetchCommunities().then(setCommunities);
  }, []);

  // Purely derived from the current input + fetched communities — no state/effect needed.
  const filtered = useMemo(() => {
    if (!value) return [];
    const q = value.toLowerCase();
    return communities.filter(c => c.name.toLowerCase().includes(q) || c.domain.toLowerCase().includes(q));
  }, [value, communities]);

  return (
    <div className="relative">
      {label && <label className="text-xs font-bold text-slate-400 uppercase ml-1">{label}</label>}
      <input
        type="text"
        value={value}
        onChange={e => { onChange(e.target.value); setShow(true); }}
        onFocus={() => setShow(true)}
        className={className || "w-full h-12 bg-slate-50 border border-slate-100 rounded-2xl px-4 font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"}
        placeholder={placeholder}
      />
      {hint && <p className="mt-1.5 ml-1 text-[11px] leading-snug opacity-70">{hint}</p>}
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
