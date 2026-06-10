
import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Icons } from './ui/Icons';
import { Community, Lifetree } from '../types';
import { fetchCommunities, createCommunity, getCommunityByDomain } from '../services/firebase';
import { communityThemePresets } from '../utils/theme';
import { Loading } from './ui/Loading';
import { SectionHeader } from './ui/SectionHeader';
import { DefaultCardImage } from './ui/DefaultCardImage';

interface CommunityListProps {
  onSelect: (community: Community) => void;
  myTrees: Lifetree[];
  currentUserId?: string;
}

export const CommunityList: React.FC<CommunityListProps> = ({ onSelect, myTrees, currentUserId }) => {
  const { t } = useLanguage();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [genesisCommunity, setGenesisCommunity] = useState<Community | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDomain, setNewDomain] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [search, setSearch] = useState('');

  const matchesSearch = (c: Community) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return `${c.name || ''} ${c.domain || ''} ${c.vision || ''}`.toLowerCase().includes(term);
  };
  const filteredCommunities = communities.filter(matchesSearch);
  const showGenesis = genesisCommunity && matchesSearch(genesisCommunity);

  useEffect(() => {
    const domain = window.location.hostname;
    
    Promise.all([
        fetchCommunities(),
        getCommunityByDomain(domain)
    ]).then(([allCommunities, currentDomainCommunity]) => {
      // If we found a community for current domain, mark it as genesis and filter it from the main list
      if (currentDomainCommunity) {
          setGenesisCommunity(currentDomainCommunity);
          setCommunities(allCommunities.filter(c => c.id !== currentDomainCommunity.id));
      } else {
          setCommunities(allCommunities);
      }
      setLoading(false);
    }).catch((error) => {
      console.error("Failed to load communities", error);
      setCommunities([]);
      setGenesisCommunity(null);
      setLoading(false);
    });
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentUserId || !newName || !newDomain) return;
    
    setIsCreating(true);
    try {
      const newCommunity = {
        name: newName,
        domain: newDomain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, ''),
        vision: '',
        imageUrls: [],
        theme: communityThemePresets[0],
        ownerId: currentUserId
      };
      const created = await createCommunity(newCommunity);
      setCommunities(prev => [created, ...prev]);
      setShowCreate(false);
      setNewName('');
      setNewDomain('');
    } catch (e) {
      console.error(e);
      alert("Failed to create community.");
    }
    setIsCreating(false);
  };

  const CommunityCard = ({ community, isGenesis = false }: { community: Community, isGenesis?: boolean }) => (
    <div 
        onClick={() => onSelect(community)}
        className={`group bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-2xl border transition-all cursor-pointer hover:-translate-y-1 relative ${isGenesis ? 'border-amber-400 ring-4 ring-amber-400/20 md:col-span-2 lg:col-span-1' : 'border-slate-100'}`}
    >
        {isGenesis && (
            <div className="absolute top-4 left-4 z-20 bg-amber-500 text-white text-[10px] font-black px-3 py-1 rounded-full shadow-lg flex items-center gap-1 uppercase tracking-tighter">
                <Icons.SparkleFill size={10} /> Community 0
            </div>
        )}
        <div className="aspect-[16/9] relative overflow-hidden bg-slate-100">
            {community.imageUrls && community.imageUrls.length > 0 ? (
                <img 
                src={community.imageUrls[0]} 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
                alt={community.name} 
                />
            ) : (
                <DefaultCardImage />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60"></div>
            <div className="absolute bottom-4 left-4 right-4">
                <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/30 bg-white/20 backdrop-blur-md">
                        {community.logoUrl ? (
                            <img src={community.logoUrl} className="h-full w-full object-cover" alt={`${community.name} logo`} />
                        ) : (
                            <Icons.Globe />
                        )}
                    </div>
                    <div className="min-w-0">
                        <h2 className="truncate text-lg font-bold text-white drop-shadow-md">{community.name}</h2>
                        <p className="truncate font-mono text-xs text-emerald-300 drop-shadow-md">{community.domain}</p>
                    </div>
                </div>
            </div>
        </div>
        <div className="p-6">
            <div 
                className="text-slate-600 text-sm line-clamp-3 mb-4 h-11 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: community.vision || 'No vision shared yet.' }}
            />
            <button className="text-emerald-600 font-bold text-xs uppercase tracking-widest flex items-center gap-1 group-hover:gap-2 transition-all">
                View Profile <Icons.ArrowRight size={16} />
            </button>
        </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto p-6 animate-in fade-in duration-500">
      <SectionHeader
        icon={<Icons.Globe />}
        title={t('communities')}
        subtitle="Connecting vertical forests with global visions."
        footer={
          <div className="relative w-full">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400"><Icons.Search /></div>
            <input
              dir="auto"
              type="text"
              className="block w-full pl-10 pr-3 py-2 border border-emerald-100 rounded-xl leading-5 bg-white/80 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm shadow-sm"
              placeholder="Search communities..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        }
        action={myTrees.length > 0 ? (
          <button
            onClick={() => setShowCreate(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-full font-bold shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-2 border border-emerald-500/30 active:scale-95"
          >
            <Icons.Plus />
            <span>{t('register_community')}</span>
          </button>
        ) : undefined}
      >
        {loading ? (
          <div className="flex justify-center py-24">
            <Loading />
          </div>
        ) : (communities.length === 0 && !genesisCommunity) ? (
          <div className="bg-white/90 backdrop-blur-sm border border-slate-200 rounded-[2rem] p-12 md:p-20 text-center flex flex-col items-center shadow-xl animate-in zoom-in-95 duration-700">
              <div className="mb-8 p-6 bg-slate-50 rounded-full border border-slate-200 text-slate-300 rotate-12 group hover:rotate-0 transition-transform duration-500">
                  <Icons.Globe size={80} />
              </div>
              <h2 className="text-3xl font-light text-slate-950 mb-4">No Communities Registered</h2>
              <p className="text-slate-500 max-w-md mx-auto mb-10 leading-relaxed">
                  Be the first to plant a global vision. Communities connect vertical forest nodes into a unified brand and purpose.
              </p>
              {myTrees.length > 0 ? (
                  <button
                      onClick={() => setShowCreate(true)}
                      className="bg-emerald-600 text-white px-10 py-4 rounded-full font-bold shadow-xl hover:bg-emerald-700 transition-all flex items-center gap-2 active:scale-95"
                  >
                      <Icons.Plus />
                      <span>Start a Community</span>
                  </button>
              ) : (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-amber-700 text-sm flex items-center gap-3">
                      <Icons.Tree />
                      <span>You need to plant a lifetree before you can start a community.</span>
                  </div>
              )}
          </div>
        ) : (filteredCommunities.length === 0 && !showGenesis) ? (
          <p className="text-center text-slate-400 py-16">No communities match your search.</p>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {showGenesis && <CommunityCard community={genesisCommunity!} isGenesis={true} />}
            {filteredCommunities.map(community => (
              <div key={community.id}>
                <CommunityCard community={community} />
              </div>
            ))}
          </div>
        )}
      </SectionHeader>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 animate-in zoom-in-95 duration-200">
            <h2 className="text-2xl font-light mb-6">Register Community</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase ml-1">Name</label>
                <input 
                  type="text" 
                  required 
                  value={newName} 
                  onChange={e => setNewName(e.target.value)} 
                  className="w-full h-12 bg-slate-50 border border-slate-100 rounded-2xl px-4 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Community Name"
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
                  {isCreating ? 'Creating...' : 'Create Community'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
