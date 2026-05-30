
import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Icons } from './ui/Icons';
import { Organisation, Lifetree } from '../types';
import { fetchOrganisations, createOrganisation } from '../services/firebase';

interface OrganisationListProps {
  onSelect: (org: Organisation) => void;
  myTrees: Lifetree[];
  currentUserId?: string;
}

export const OrganisationList: React.FC<OrganisationListProps> = ({ onSelect, myTrees, currentUserId }) => {
  const { t } = useLanguage();
  const [orgs, setOrgs] = useState<Organisation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDomain, setNewDomain] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    fetchOrganisations().then(orgs => {
      setOrgs(orgs);
      setLoading(false);
    });
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentUserId || !newName || !newDomain) return;
    
    setIsCreating(true);
    try {
      const newOrg = {
        name: newName,
        domain: newDomain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, ''),
        vision: '',
        imageUrls: [],
        ownerId: currentUserId
      };
      const created = await createOrganisation(newOrg);
      setOrgs(prev => [created, ...prev]);
      setShowCreate(false);
      setNewName('');
      setNewDomain('');
    } catch (e) {
      console.error(e);
      alert("Failed to create organization.");
    }
    setIsCreating(false);
  };

  return (
    <div className="max-w-6xl mx-auto p-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row items-center justify-between mb-12 gap-6 bg-white/10 backdrop-blur-md p-8 rounded-3xl border border-white/10 shadow-xl">
        <div className="text-center md:text-left">
          <h1 className="text-4xl font-thin tracking-tight text-white">{t('organisations')}</h1>
          <p className="text-emerald-100/70 mt-2">Connecting vertical forests with global visions.</p>
        </div>
        {myTrees.length > 0 && (
          <button 
            onClick={() => setShowCreate(true)} 
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-full font-bold shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-2 border border-emerald-500/30 active:scale-95"
          >
            <Icons.Plus />
            <span>{t('register_organisation')}</span>
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-24">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-500 border-t-transparent"></div>
        </div>
      ) : orgs.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {orgs.map(org => (
            <div 
              key={org.id} 
              onClick={() => onSelect(org)}
              className="group bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-2xl border border-slate-100 transition-all cursor-pointer hover:-translate-y-1"
            >
              <div className="aspect-[16/9] relative overflow-hidden bg-slate-100">
                {org.imageUrls && org.imageUrls.length > 0 ? (
                  <img 
                    src={org.imageUrls[0]} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
                    alt={org.name} 
                  />
                ) : (
                  <div className="flex items-center justify-center h-full group-hover:bg-slate-200 transition-colors">
                    <Icons.Building className="text-slate-300" size={48} />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60"></div>
                <div className="absolute bottom-4 left-4 right-4">
                  <h2 className="text-white font-bold text-lg truncate drop-shadow-md">{org.name}</h2>
                  <p className="text-emerald-300 text-xs font-mono drop-shadow-md">{org.domain}</p>
                </div>
              </div>
              <div className="p-6">
                <div 
                  className="text-slate-600 text-sm line-clamp-3 mb-4 h-11 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: org.vision || 'No vision shared yet.' }}
                />
                <button className="text-emerald-600 font-bold text-xs uppercase tracking-widest flex items-center gap-1 group-hover:gap-2 transition-all">
                  View Profile <Icons.ArrowRight size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-[3rem] p-12 md:p-24 text-center flex flex-col items-center shadow-2xl animate-in zoom-in-95 duration-700">
            <div className="mb-8 p-6 bg-white/10 rounded-full border border-white/20 text-white/40 rotate-12 group hover:rotate-0 transition-transform duration-500">
                <Icons.Building size={80} />
            </div>
            <h2 className="text-3xl font-light text-white mb-4">No Organizations Registered</h2>
            <p className="text-emerald-100/60 max-w-md mx-auto mb-10 leading-relaxed">
                Be the first to plant a global vision. Organizations connect vertical forest nodes into a unified brand and purpose.
            </p>
            {myTrees.length > 0 ? (
                <button 
                    onClick={() => setShowCreate(true)} 
                    className="bg-white text-emerald-900 px-10 py-4 rounded-full font-bold shadow-xl hover:bg-emerald-50 transition-all flex items-center gap-2 active:scale-95"
                >
                    <Icons.Plus />
                    <span>Start an Organisation</span>
                </button>
            ) : (
                <div className="bg-amber-400/10 border border-amber-400/20 rounded-2xl p-4 text-amber-200 text-sm flex items-center gap-3">
                    <Icons.Tree />
                    <span>You need to plant a lifetree before you can start an organisation.</span>
                </div>
            )}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 animate-in zoom-in-95 duration-200">
            <h2 className="text-2xl font-light mb-6">Register Organisation</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase ml-1">Name</label>
                <input 
                  type="text" 
                  required 
                  value={newName} 
                  onChange={e => setNewName(e.target.value)} 
                  className="w-full h-12 bg-slate-50 border border-slate-100 rounded-2xl px-4 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Organisation Name"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase ml-1">Domain</label>
                <input 
                  type="text" 
                  required 
                  value={newDomain} 
                  onChange={e => setNewDomain(e.target.value)} 
                  className="w-full h-12 bg-slate-50 border border-slate-100 rounded-2xl px-4 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="example.com"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowCreate(false)} 
                  className="flex-1 h-12 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isCreating} 
                  className="flex-1 h-12 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 disabled:opacity-50"
                >
                  {isCreating ? 'Creating...' : 'Create Organisation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
