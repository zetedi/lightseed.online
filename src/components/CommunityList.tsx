
import React, { useState, useEffect } from 'react';
import { showAlert } from "./ui/Dialog";
import { useLanguage } from '../contexts/LanguageContext';
import { Icons } from './ui/Icons';
import { MahameruAvatar } from './ui/MahameruAvatar';
import { Community, Lifetree } from '../types';
import { fetchCommunities, createCommunity, getCommunityByDomain, getMyVisions } from '../services/firebase';
import { matchCommunities, type CommunityMatch } from '../domain/match';
import { firestoreStore } from '../adapters/firestore';
import { notify } from './ui/Toast';
import { communityThemePresets } from '../utils/theme';
import { sanitizeRichText } from '../utils/sanitize';
import { Loading } from './ui/Loading';
import { SectionHeader } from './ui/SectionHeader';
import { ListBox } from './ui/ListBox';
import { tabTone, CTA_GLOW } from '../utils/tabTheme';

interface CommunityListProps {
  onSelect: (community: Community) => void;
  myTrees: Lifetree[];
  currentUserId?: string;
}

// The community's hero image IS the card's background; the content reads over it. Without an
// image the card wears the community's own colour (or the communities tone) — no placeholder art.
type CardStanding = 'keeper' | 'member' | 'requested' | 'joinable';

const CommunityCard = ({ community, isGenesis = false, onSelect, standing = 'joinable', onJoin }: { community: Community, isGenesis?: boolean, onSelect: (community: Community) => void, standing?: CardStanding, onJoin?: (community: Community) => void }) => {
  const hero = (community as any).heroImageUrl || community.imageUrls?.[0];
  return (
  <div
      onClick={() => onSelect(community)}
      className={`group rounded-xl overflow-hidden shadow-sm hover:shadow-2xl active:shadow-2xl border transition-all cursor-pointer hover:-translate-y-1 active:-translate-y-1 relative min-h-[15rem] flex flex-col justify-end ${isGenesis ? 'border-amber-400 ring-4 ring-amber-400/20 md:col-span-2 lg:col-span-1' : 'border-slate-100'}`}
      style={!hero ? { backgroundColor: (community as any).theme?.primary || tabTone('communities') } : undefined}
  >
      {hero && (
          <>
              <img src={hero} className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" alt={community.name} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10"></div>
          </>
      )}
      {!hero && <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent"></div>}
      {isGenesis && (
          <div className="absolute top-4 left-4 z-20 bg-amber-500 text-white text-[10px] font-black px-3 py-1 rounded-full shadow-lg flex items-center gap-1 uppercase tracking-tighter">
              <MahameruAvatar size={14} /> Community 0
          </div>
      )}
      <div className="relative z-10 p-5">
          <div className="mb-2.5 flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/30 bg-white/20 backdrop-blur-md text-white">
                  {community.logoUrl ? (
                      <img src={community.logoUrl} className="h-full w-full object-cover" alt={`${community.name} logo`} />
                  ) : (
                      <Icons.Globe />
                  )}
              </div>
              <div className="min-w-0">
                  <h2 className="line-clamp-2 break-words text-lg font-bold text-white drop-shadow-md">{community.name}</h2>
                  <p className="truncate font-mono text-xs text-emerald-200 drop-shadow-md">{community.domain}</p>
              </div>
          </div>
          <div
              className="text-white/85 text-sm line-clamp-2 mb-3 leading-relaxed overflow-hidden drop-shadow [&_img]:hidden"
              dangerouslySetInnerHTML={{ __html: community.vision ? sanitizeRichText(community.vision) : 'No vision shared yet.' }}
          />
          <div className="flex items-center justify-between gap-2">
              <button className="text-white font-bold text-xs uppercase tracking-widest flex items-center gap-1 group-hover:gap-2 transition-all drop-shadow">
                  View Profile <Icons.ArrowRight size={16} />
              </button>
              {standing === 'keeper' && (
                  <span className="rounded-full bg-amber-400/90 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-amber-950 shadow">Keeper</span>
              )}
              {standing === 'member' && (
                  <span className="rounded-full bg-emerald-500/90 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-white shadow">Member</span>
              )}
              {standing === 'requested' && (
                  <span className="rounded-full bg-white/25 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-white shadow backdrop-blur">Requested</span>
              )}
              {standing === 'joinable' && onJoin && (
                  <button
                      onClick={(e) => { e.stopPropagation(); onJoin(community); }}
                      className={`rounded-full bg-emerald-600 px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-white shadow-lg transition-all hover:bg-emerald-500 active:scale-95 ${CTA_GLOW}`}
                  >
                      Join
                  </button>
              )}
          </div>
      </div>
  </div>
); };

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
  // Where the viewer already stands: keeper / member / requested — read from the LIN once.
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set());
  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!currentUserId) return;
    let alive = true;
    Promise.all([
      firestoreStore.linksFrom(currentUserId, 'member').catch(() => []),
      firestoreStore.linksFrom(currentUserId, 'join_request').catch(() => []),
    ]).then(([members, requests]) => {
      if (!alive) return;
      setMemberIds(new Set(members.map(l => l.to)));
      setRequestedIds(new Set(requests.map(l => l.to)));
    });
    return () => { alive = false; };
  }, [currentUserId]);

  const standingOf = (c: Community): CardStanding =>
    c.ownerId === currentUserId ? 'keeper'
      : memberIds.has(c.id) ? 'member'
      : requestedIds.has(c.id) ? 'requested'
      : 'joinable';

  // Join straight from the card — the same request the community profile sends.
  const handleJoin = async (c: Community) => {
    if (!currentUserId) { showAlert('Sign in to join this community.'); return; }
    try {
      await firestoreStore.link(currentUserId, 'join_request', c.id);
      setRequestedIds(prev => new Set([...prev, c.id]));
      notify(`Your request to join ${c.name} is on its way to its keepers.`);
    } catch (e: any) {
      showAlert(e?.message || 'Could not send the join request.');
    }
  };

  // Vision ↔ community resonance: the top three communities whose visions share the most
  // ground with the visions this being has created (domain/match — inspectable words, no AI).
  const [matches, setMatches] = useState<CommunityMatch<Community>[] | null>(null);
  const [isMatching, setIsMatching] = useState(false);
  const handleMatch = async () => {
    if (!currentUserId) { showAlert('Sign in to find your resonant communities.'); return; }
    if (isMatching) return;
    setIsMatching(true);
    try {
      const visions = await getMyVisions(currentUserId);
      const texts = visions.map(v => `${v.title || ''} ${v.body || ''} ${(v as any).description || ''}`);
      if (texts.length === 0) {
        showAlert('Create a vision first — matching reads the visions you have planted.');
      } else {
        const pool = [...communities, ...(genesisCommunity ? [genesisCommunity] : [])];
        const found = matchCommunities(texts, pool, 3);
        setMatches(found);
        if (found.length === 0) showAlert('No shared ground found yet — your visions speak a language no community here speaks. Yet.');
      }
    } catch (e: any) {
      showAlert(e?.message || 'Could not read the resonance.');
    }
    setIsMatching(false);
  };

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
      showAlert("Failed to create community.");
    }
    setIsCreating(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 pt-6 pb-4 sm:px-6 sm:pb-6 animate-in fade-in duration-500 overflow-x-hidden">
      <SectionHeader
        title={t('communities')}
        tone={tabTone('communities')}
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
            className={`bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-1.5 active:scale-95 ${CTA_GLOW}`}
          >
            <Icons.Plus />
            <span>{t('register_community')}</span>
          </button>
        ) : undefined}
      >
        <ListBox tone={tabTone('communities')}>
        {loading ? (
          <div className="flex justify-center py-24">
            <Loading />
          </div>
        ) : (communities.length === 0 && !genesisCommunity) ? (
          <div className="bg-white/90 backdrop-blur-sm border border-slate-200 rounded-2xl p-12 md:p-20 text-center flex flex-col items-center shadow-xl animate-in zoom-in-95 duration-700">
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
          <p className="text-center text-slate-500 py-16">No communities match your search.</p>
        ) : (
          <>
          {currentUserId && (
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <button onClick={handleMatch} disabled={isMatching}
                className={`flex items-center gap-2 rounded-full bg-amber-500 px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-white shadow-lg transition-all hover:bg-amber-600 active:scale-95 disabled:opacity-60 ${CTA_GLOW}`}>
                <Icons.Venn />
                <span>{isMatching ? 'Reading resonance…' : 'Match with a community'}</span>
              </button>
              {matches && matches.length > 0 && (
                <button onClick={() => setMatches(null)} className="text-xs font-medium text-slate-400 transition-colors hover:text-slate-600">Clear</button>
              )}
            </div>
          )}

          {matches && matches.length > 0 && (
            <div className="mb-8 space-y-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-4 animate-in fade-in slide-in-from-top-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-600">Your resonant communities — read from your visions</p>
              {matches.map((m, i) => (
                <div key={m.community.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-100 bg-white p-3 shadow-sm">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500 text-sm font-black text-white">{i + 1}</span>
                  <button onClick={() => onSelect(m.community)} className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-sm font-bold text-slate-800 hover:text-amber-700">{m.community.name}</span>
                    <span className="block truncate text-[11px] text-slate-400">
                      {Math.round(m.score * 100)}% shared ground · {m.shared.join(' · ')}
                    </span>
                  </button>
                  {standingOf(m.community) === 'joinable' ? (
                    <button onClick={() => handleJoin(m.community)}
                      className="shrink-0 rounded-full bg-emerald-600 px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-white shadow transition-all hover:bg-emerald-500 active:scale-95">
                      Join
                    </button>
                  ) : (
                    <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-500 capitalize">{standingOf(m.community)}</span>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-8">
            {showGenesis && <CommunityCard community={genesisCommunity!} isGenesis={true} onSelect={onSelect} standing={standingOf(genesisCommunity!)} onJoin={handleJoin} />}
            {filteredCommunities.map(community => (
              <div key={community.id}>
                <CommunityCard community={community} onSelect={onSelect} standing={standingOf(community)} onJoin={handleJoin} />
              </div>
            ))}
          </div>
          </>
        )}
        </ListBox>
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
