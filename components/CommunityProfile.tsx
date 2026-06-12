
import React, { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Icons } from './ui/Icons';
import { Community, Lifetree, Lightseed, Pulse, Intelligence, Persona, Sanctuary } from '../types';
import { updateCommunity, uploadImage, getTreesByDomain, deleteCommunity, createCommunityEvent, getCommunityByDomain, getCommunityEvents, toggleGuardianship, getSanctuariesByDomain } from '../services/firebase';
import { getSelectableIntelligences, listPersonas } from '../services/intelligence';
import RichTextEditor from './ui/RichTextEditor';
import { ImagePicker } from './ui/ImagePicker';
import { DefaultCardImage } from './ui/DefaultCardImage';
import { communityThemePresets, normalizeTheme, type CommunityThemePreset } from '../utils/theme';
import { LoreSection, loreTabs, type LoreTabId } from './about/AboutSections';

interface CommunityProfileProps {
  community: Community;
  onUpdate?: (updates: Partial<Community>) => void;
  onClose: () => void;
  onViewTree?: (tree: Lifetree) => void;
  currentUser?: Lightseed | null;
  currentUserId?: string;
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
}

type TabKey = 'vision' | 'firsttree' | 'sanctuary' | 'trees' | 'events' | LoreTabId | 'intelligence' | 'appearance';

const PROVIDER_LABELS: Record<string, string> = {
  google: 'Google · Gemini',
  openai: 'OpenAI',
  anthropic: 'Anthropic · Claude',
  deepseek: 'DeepSeek',
  local: 'Local model',
};

const bareDomain = (d?: string) => (d || '').toLowerCase().replace(/^www\./, '');

const THEME_FIELDS = ['primary', 'secondary', 'accent', 'neutral', 'background', 'surface', 'text', 'mode'] as const;
const themeEquals = (a: any, b: any) => THEME_FIELDS.every(k => a[k] === b[k]);

export const CommunityProfile: React.FC<CommunityProfileProps> = ({
  community,
  onUpdate,
  onClose,
  onViewTree,
  currentUser,
  currentUserId,
  isAdmin,
  isSuperAdmin
}) => {
  const { t } = useLanguage();
  const canEdit = currentUserId === community.ownerId || isSuperAdmin || isAdmin;
  const canDelete = currentUserId === community.ownerId || isSuperAdmin;

  const [activeTab, setActiveTab] = useState<TabKey>('vision');

  // Editable copies of the community fields (branding + vision).
  const [editName, setEditName] = useState(community.name);
  const [editVision, setEditVision] = useState(community.vision);
  const [editTheme, setEditTheme] = useState(normalizeTheme(community.theme));
  const [isCustomTheme, setIsCustomTheme] = useState(false);
  const [logoUrl, setLogoUrl] = useState(community.logoUrl || '');
  const [imageUrls, setImageUrls] = useState<string[]>(community.imageUrls || []);

  // Community Intelligence config
  const [intelligences, setIntelligences] = useState<Intelligence[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [editDefaultIntelligenceId, setEditDefaultIntelligenceId] = useState(community.defaultIntelligenceId || '');
  const [editAvailableIntelligenceIds, setEditAvailableIntelligenceIds] = useState<string[]>(community.availableIntelligenceIds || []);
  const [isSavingIntel, setIsSavingIntel] = useState(false);

  const [linkedTrees, setLinkedTrees] = useState<Lifetree[]>([]);
  const [sanctuaries, setSanctuaries] = useState<Sanctuary[]>([]);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  // Events
  const [events, setEvents] = useState<Pulse[]>([]);
  const [eventTitle, setEventTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [eventBody, setEventBody] = useState('');
  const [eventImageUrls, setEventImageUrls] = useState<string[]>([]);
  const [isEventSaving, setIsEventSaving] = useState(false);
  const [isUploadingEventImage, setIsUploadingEventImage] = useState(false);

  // Keep editable copies in sync whenever the community prop changes (e.g. after refresh).
  useEffect(() => {
    setEditName(community.name);
    setEditVision(community.vision);
    const normalized = normalizeTheme(community.theme);
    setEditTheme(normalized);
    // A theme that matches no preset is, by definition, a saved custom theme.
    setIsCustomTheme(!communityThemePresets.some(p => themeEquals(normalized, p)));
    setLogoUrl(community.logoUrl || '');
    setImageUrls(community.imageUrls || []);
    setEditDefaultIntelligenceId(community.defaultIntelligenceId || '');
    setEditAvailableIntelligenceIds(community.availableIntelligenceIds || []);
  }, [community.id, community.name, community.vision, community.logoUrl, community.theme, (community.imageUrls || []).join(','), community.defaultIntelligenceId, (community.availableIntelligenceIds || []).join(',')]);

  // Intelligences an admin can choose from (public + owned), plus persona names.
  useEffect(() => {
    if (!canEdit) return;
    getSelectableIntelligences(currentUserId).then(setIntelligences).catch(() => {});
    listPersonas().then(setPersonas).catch(() => {});
  }, [canEdit, currentUserId]);

  useEffect(() => {
    getTreesByDomain(community.domain, currentUserId).then(setLinkedTrees).catch(() => {});
  }, [community.domain, currentUserId]);

  useEffect(() => {
    getCommunityEvents(community.id).then(setEvents).catch(() => {});
  }, [community.id]);

  useEffect(() => {
    getSanctuariesByDomain(community.domain).then(setSanctuaries).catch(() => {});
  }, [community.domain]);

  // The first sanctuary rooted in this domain (earliest), shown as "The Sanctuary".
  const firstSanctuary = sanctuaries[0] || null;

  // The first lifetree rooted in this community's domain (earliest planted).
  const domainTrees = useMemo(() => {
    const d = bareDomain(community.domain);
    return linkedTrees
      .filter(tree => bareDomain(tree.domain) === d)
      .sort((a, b) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0));
  }, [linkedTrees, community.domain]);
  const firstTree = domainTrees[0] || null;

  const isGuardian = (tree: Lifetree) => !!currentUserId && (tree.guardians || []).includes(currentUserId);

  const handleToggleGuardian = async (tree: Lifetree) => {
    if (!currentUserId) { alert('Sign in to join a guardianship.'); return; }
    const join = !isGuardian(tree);
    setTogglingId(tree.id);
    try {
      await toggleGuardianship(tree.id, currentUserId, join);
      setLinkedTrees(prev => prev.map(t => t.id === tree.id
        ? { ...t, guardians: join ? [...(t.guardians || []), currentUserId] : (t.guardians || []).filter(g => g !== currentUserId) }
        : t));
    } catch (e) {
      console.error(e);
      alert('Failed to update guardianship.');
    }
    setTogglingId(null);
  };

  const personaName = (id?: string) => personas.find(p => p.id === id)?.name;

  // Toggle whether an intelligence is available to this community; keep the default valid.
  const toggleAvailable = (id: string) => {
    setEditAvailableIntelligenceIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      if (!next.includes(editDefaultIntelligenceId)) setEditDefaultIntelligenceId(next[0] || '');
      return next;
    });
  };

  const setDefaultIntelligence = (id: string) => {
    setEditDefaultIntelligenceId(id);
    setEditAvailableIntelligenceIds(prev => prev.includes(id) ? prev : [...prev, id]);
  };

  const handleSaveIntelligence = async () => {
    setIsSavingIntel(true);
    setStatus(null);
    try {
      const updates = {
        defaultIntelligenceId: editDefaultIntelligenceId || '',
        availableIntelligenceIds: editAvailableIntelligenceIds,
      };
      await updateCommunity(community.id, updates);
      if (onUpdate) onUpdate(updates);
      setStatus('Saved.');
      setTimeout(() => setStatus(null), 2500);
    } catch (e) {
      console.error(e);
      setStatus('Failed to save. Please try again.');
    }
    setIsSavingIntel(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setStatus(null);
    try {
      const updates = {
        name: editName,
        vision: editVision,
        imageUrls,
        theme: normalizeTheme(editTheme),
        logoUrl,
      };
      await updateCommunity(community.id, updates);
      // Refresh from Firestore so the view reflects exactly what was persisted.
      const fresh = await getCommunityByDomain(community.domain);
      if (onUpdate) onUpdate(fresh ? { ...fresh } : updates);
      setStatus('Saved.');
      setTimeout(() => setStatus(null), 2500);
    } catch (e) {
      console.error(e);
      setStatus('Failed to save. Please try again.');
    }
    setIsSaving(false);
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this community? This cannot be undone.')) return;
    setIsDeleting(true);
    try {
      await deleteCommunity(community.id);
      onClose();
      window.location.reload();
    } catch (e) {
      console.error(e);
      alert('Failed to delete community.');
    }
    setIsDeleting(false);
  };

  const handleLogoUpload = async (file: File) => {
    setIsUploadingLogo(true);
    try {
      const url = await uploadImage(file, `communities/${community.id}/logo_${Date.now()}`);
      setLogoUrl(url);
    } catch (e: any) {
      console.error(e);
      setStatus(e?.message || 'Failed to upload logo.');
    }
    setIsUploadingLogo(false);
  };

  const handleAddImage = async (file: File) => {
    setIsUploadingImage(true);
    try {
      const url = await uploadImage(file, `communities/${community.id}/${Date.now()}`);
      setImageUrls(prev => [...prev, url]);
    } catch (e: any) {
      console.error(e);
      setStatus(e?.message || 'Failed to upload image.');
    }
    setIsUploadingImage(false);
  };

  const handleRemoveImage = (index: number) => {
    setImageUrls(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddEventImage = async (file: File) => {
    setIsUploadingEventImage(true);
    try {
      const url = await uploadImage(file, `communities/${community.id}/events/${Date.now()}`);
      setEventImageUrls(prev => [...prev, url]);
    } catch (e) {
      console.error(e);
      alert('Failed to upload event image.');
    }
    setIsUploadingEventImage(false);
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserId || !eventTitle.trim() || isEventSaving) return;
    setIsEventSaving(true);
    try {
      await createCommunityEvent(community, {
        title: eventTitle.trim(),
        body: eventBody.trim(),
        content: eventBody.trim(),
        imageUrl: eventImageUrls[0] || '',
        imageUrls: eventImageUrls,
        eventDate: eventDate || '',
        eventLocation: eventLocation.trim(),
        authorId: currentUserId,
        authorName: currentUser?.displayName || 'Community Admin',
        authorPhoto: currentUser?.photoURL || undefined,
      });
      setEventTitle('');
      setEventDate('');
      setEventLocation('');
      setEventBody('');
      setEventImageUrls([]);
      getCommunityEvents(community.id).then(setEvents).catch(() => {});
    } catch (error: any) {
      console.error(error);
      alert('Failed to create event: ' + (error.message || 'Unknown error'));
    }
    setIsEventSaving(false);
  };

  // Icons for the shared network-lore tabs (Path, Yantra).
  const loreIcons: Record<LoreTabId, React.ReactNode> = {
    path: <Icons.ArrowRight />,
    yantra: <Icons.Venn />,
  };

  const navSections: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'vision', label: 'Vision', icon: <Icons.FingerPrint /> },
    { key: 'firsttree', label: 'First Tree', icon: <Icons.Tree /> },
    { key: 'sanctuary', label: 'The Sanctuary', icon: <Icons.Sun /> },
    { key: 'trees', label: 'Community Trees', icon: <Icons.Tree /> },
    { key: 'events', label: 'Events', icon: <Icons.Loc /> },
    // The network's foundational story travels to every node's about page.
    ...loreTabs.map(tab => ({ key: tab.id as TabKey, label: tab.label, icon: loreIcons[tab.id] })),
    ...(canEdit ? [
      { key: 'intelligence' as TabKey, label: 'Intelligence', icon: <Icons.Sparkles /> },
      { key: 'appearance' as TabKey, label: 'Appearance', icon: <Icons.Image /> },
    ] : []),
  ];

  const isLoreTab = (key: TabKey): key is LoreTabId => loreTabs.some(tab => tab.id === key);

  const SectionTitle = ({ title, sub }: { title: string; sub?: string }) => (
    <div className="mb-6">
      <h2 className="text-xl font-bold text-slate-900">{title}</h2>
      {sub && <p className="mt-1 text-sm text-slate-500">{sub}</p>}
    </div>
  );

  const SaveBar = () => canEdit ? (
    <div className="mt-6 flex items-center gap-3">
      <button onClick={handleSave} disabled={isSaving || isUploadingLogo || isUploadingImage} className="rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 transition-all hover:bg-emerald-700 disabled:opacity-50">
        {isSaving ? 'Saving...' : 'Save Changes'}
      </button>
      {status && <span className="text-sm text-slate-500">{status}</span>}
    </div>
  ) : null;

  const GuardianButton = ({ tree }: { tree: Lifetree }) => {
    const guard = isGuardian(tree);
    const busy = togglingId === tree.id;
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); handleToggleGuardian(tree); }}
        disabled={busy}
        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold transition-colors disabled:opacity-50 ${guard ? 'bg-emerald-100 text-emerald-700 hover:bg-red-50 hover:text-red-600' : 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700'}`}
        title={guard ? 'Leave guardianship' : 'Join guardianship'}
      >
        <Icons.Tree />
        <span>{busy ? '...' : guard ? 'Guardian' : 'Join'}</span>
      </button>
    );
  };

  return (
    <div className="min-h-screen pb-20">
      {/* Hero — mirrors the personal profile */}
      <div className="relative bg-gradient-to-b from-slate-800 to-slate-900 text-white pt-6 pb-16 px-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between mb-6">
          <button onClick={onClose} className="flex items-center gap-2 text-white/70 hover:text-white text-sm font-medium">
            <Icons.ArrowLeft />
            <span>Back</span>
          </button>
          {canDelete && (
            <button onClick={handleDelete} disabled={isDeleting} className="bg-red-500/15 hover:bg-red-500 text-red-300 hover:text-white px-4 py-2 rounded-full font-bold text-xs transition-colors flex items-center gap-1 border border-red-400/30">
              <Icons.Trash /><span>Delete</span>
            </button>
          )}
        </div>

        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center md:items-end gap-6 md:gap-8">
          <div className="flex h-24 w-24 md:h-28 md:w-28 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-white shadow-xl">
            {logoUrl ? (
              <img src={logoUrl} className="h-full w-full object-cover" alt={`${community.name} logo`} referrerPolicy="no-referrer" />
            ) : (
              <span className="text-slate-300"><Icons.Globe /></span>
            )}
          </div>
          <div className="text-center md:text-left flex-1 min-w-0">
            <div className="flex flex-col md:flex-row md:items-baseline md:flex-wrap gap-x-4 gap-y-1 justify-center md:justify-start">
              <h1 className="min-w-0 break-words text-3xl font-light tracking-wide">{community.name}</h1>
              <span className="inline-flex items-baseline gap-1 text-slate-300">
                <span className="text-lg font-bold text-white">{domainTrees.length}</span>
                <span className="text-sm text-slate-400">{domainTrees.length === 1 ? t('tree') : t('trees')}</span>
              </span>
            </div>
            {/* Details live in the header */}
            <div className="mt-3 flex items-center gap-2 flex-wrap justify-center md:justify-start text-xs">
              <a href={`https://${community.domain}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 font-mono text-emerald-300 hover:bg-emerald-400/20">
                <Icons.Globe size={12} /> {community.domain}
              </a>
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-slate-300">
                Since {community.createdAt?.toDate ? community.createdAt.toDate().toLocaleDateString() : '—'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Body: sidebar + content */}
      <div className="relative z-10 max-w-6xl mx-auto px-4 -mt-8">
        <div className="lg:grid lg:grid-cols-[230px_1fr] lg:gap-6">
          <aside className="mb-4 lg:mb-0">
            <div className="rounded-2xl border border-slate-100 bg-white p-2.5 shadow-xl lg:sticky lg:top-24">
              <nav className="flex gap-1.5 overflow-x-auto lg:flex-col">
                {navSections.map(s => (
                  <button
                    key={s.key}
                    onClick={() => setActiveTab(s.key)}
                    className={`group flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all lg:w-full ${activeTab === s.key ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
                  >
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${activeTab === s.key ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400 group-hover:text-slate-600'}`}>{s.icon}</span>
                    <span className="whitespace-nowrap lg:whitespace-normal lg:break-words text-left">{s.label}</span>
                  </button>
                ))}
              </nav>
            </div>
          </aside>

          <main className="rounded-2xl border border-slate-100 bg-white p-5 sm:p-6 shadow-xl min-h-[520px]">
            {activeTab === 'vision' && (
              <div>
                <SectionTitle title="Vision" sub="What this community is growing towards." />
                {canEdit ? (
                  <>
                    <RichTextEditor value={editVision} onChange={setEditVision} placeholder="Share your community's vision..." />
                    <SaveBar />
                  </>
                ) : (
                  <div className="prose prose-slate max-w-none text-slate-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: community.vision || '<p>No vision shared yet.</p>' }} />
                )}
              </div>
            )}

            {activeTab === 'firsttree' && (
              <div>
                <SectionTitle title="First Tree" sub="The first lifetree rooted in this community's domain." />
                {!firstTree ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center text-slate-400">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-500"><Icons.Tree /></div>
                    <p className="text-sm">No lifetree has been planted in this community yet.</p>
                  </div>
                ) : (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div
                      className={`relative h-64 md:h-80 w-full overflow-hidden rounded-2xl shadow-xl ${onViewTree ? 'cursor-pointer group' : ''}`}
                      onClick={() => onViewTree?.(firstTree)}
                    >
                      {firstTree.latestGrowthUrl || firstTree.imageUrl ? (
                        <img src={firstTree.latestGrowthUrl || firstTree.imageUrl} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" alt={firstTree.name} />
                      ) : (
                        <DefaultCardImage />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                      <div className="absolute bottom-5 left-5 right-5 text-white">
                        <h2 className="break-words text-3xl font-light tracking-wide">{firstTree.name}</h2>
                        {firstTree.shortTitle && <p className="mt-1 text-sm font-bold uppercase tracking-widest text-emerald-300">{firstTree.shortTitle}</p>}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {firstTree.locationName && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-600"><Icons.Loc /> {firstTree.locationName}</span>
                      )}
                      {firstTree.validated && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 font-bold text-emerald-700">Validated</span>
                      )}
                      <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-600">
                        {(firstTree.guardians || []).length} {(firstTree.guardians || []).length === 1 ? 'guardian' : 'guardians'}
                      </span>
                    </div>

                    {firstTree.body && (
                      <p className="whitespace-pre-line text-justify font-serif text-lg leading-relaxed text-slate-700">{firstTree.body}</p>
                    )}

                    <div className="flex flex-wrap gap-3 pt-2">
                      <GuardianButton tree={firstTree} />
                      {onViewTree && (
                        <button onClick={() => onViewTree(firstTree)} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 shadow-sm transition-colors hover:border-slate-300 hover:text-slate-900">
                          <Icons.ArrowRight /> View full tree
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'sanctuary' && (
              <div>
                <SectionTitle title="The Sanctuary" sub="The first sacred place that holds this community's lifetrees." />
                {!firstSanctuary ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center text-slate-400">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-500"><Icons.Sun /></div>
                    <p className="text-sm">No sanctuary has been consecrated for this community yet.</p>
                  </div>
                ) : (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="relative h-64 md:h-80 w-full overflow-hidden rounded-2xl shadow-xl group">
                      {firstSanctuary.imageUrl ? (
                        <img src={firstSanctuary.imageUrl} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" alt={firstSanctuary.name} />
                      ) : (
                        <DefaultCardImage />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                      <div className="absolute bottom-5 left-5 right-5 text-white">
                        <h2 className="break-words text-3xl font-light tracking-wide">{firstSanctuary.name}</h2>
                        {firstSanctuary.shortTitle && <p className="mt-1 text-sm font-bold uppercase tracking-widest text-emerald-300">{firstSanctuary.shortTitle}</p>}
                      </div>
                    </div>

                    {firstSanctuary.locationName && (
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-600"><Icons.Loc /> {firstSanctuary.locationName}</span>
                      </div>
                    )}

                    {firstSanctuary.body && (
                      <p className="whitespace-pre-line text-justify font-serif text-lg leading-relaxed text-slate-700">{firstSanctuary.body}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'trees' && (
              <div>
                <SectionTitle title="Community Trees" sub="Lifetrees rooted in this community's domain. Join a guardianship to help tend one." />
                {domainTrees.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center text-slate-400">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-500"><Icons.Tree /></div>
                    <p className="text-sm">No lifetrees linked to this domain yet.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {domainTrees.map(tree => (
                      <div
                        key={tree.id}
                        className={`flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3 shadow-sm ${onViewTree ? 'cursor-pointer transition-shadow hover:shadow-md' : ''}`}
                        onClick={() => onViewTree?.(tree)}
                      >
                        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                          {tree.imageUrl ? <img src={tree.imageUrl} className="h-full w-full object-cover" alt={tree.name} /> : <DefaultCardImage />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="break-words text-sm font-bold text-slate-800">{tree.name}</p>
                          <p className="truncate text-[11px] uppercase tracking-wide text-emerald-600">{tree.locationName || '—'}</p>
                        </div>
                        <GuardianButton tree={tree} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'events' && (
              <div>
                <SectionTitle title="Events" sub="Gatherings and ceremonies for this community." />
                {canEdit && (
                  <form onSubmit={handleCreateEvent} className="mb-8 space-y-3 rounded-2xl border border-slate-100 bg-slate-50/50 p-5">
                    <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-slate-500"><Icons.Plus /> Create Event</h3>
                    <input dir="auto" value={eventTitle} onChange={e => setEventTitle(e.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Event title" required />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input type="datetime-local" value={eventDate} onChange={e => setEventDate(e.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                      <input dir="auto" value={eventLocation} onChange={e => setEventLocation(e.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Location" />
                    </div>
                    <textarea dir="auto" value={eventBody} onChange={e => setEventBody(e.target.value)} className="min-h-24 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Event details" />
                    <div className="grid grid-cols-3 gap-2">
                      {eventImageUrls.map((url, index) => (
                        <div key={url} className="relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                          <img src={url} className="h-full w-full object-cover" alt={`Event image ${index + 1}`} />
                          <button type="button" onClick={() => setEventImageUrls(prev => prev.filter((_, i) => i !== index))} className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-red-500 shadow-sm" title="Remove image">
                            <Icons.Close />
                          </button>
                        </div>
                      ))}
                      <ImagePicker onImageSelect={handleAddEventImage} loading={isUploadingEventImage} className="flex aspect-square cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-white text-slate-400 hover:border-emerald-400 hover:text-emerald-600">
                        <Icons.Plus />
                      </ImagePicker>
                    </div>
                    <button type="submit" disabled={isEventSaving || isUploadingEventImage || !eventTitle.trim()} className="w-full rounded-2xl bg-sky-600 py-3 text-sm font-bold text-white shadow-lg shadow-sky-600/20 transition-all hover:bg-sky-700 disabled:opacity-50">
                      {isEventSaving ? 'Creating...' : 'Create Event'}
                    </button>
                  </form>
                )}

                {events.length === 0 ? (
                  <p className="text-center text-slate-400 py-10 text-sm">No events yet.</p>
                ) : (
                  <div className="space-y-3">
                    {events.map(ev => (
                      <div key={ev.id} className="flex items-center gap-4 rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                          {ev.imageUrl ? <img src={ev.imageUrl} className="h-full w-full object-cover" alt={ev.title} /> : <DefaultCardImage />}
                        </div>
                        <div className="min-w-0">
                          <p className="break-words text-sm font-bold text-slate-800">{ev.title}</p>
                          <p className="truncate text-xs text-slate-500">
                            {ev.eventDate ? new Date(ev.eventDate).toLocaleString() : ''}{ev.eventLocation ? ` · ${ev.eventLocation}` : ''}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {isLoreTab(activeTab) && <LoreSection id={activeTab} />}

            {activeTab === 'intelligence' && canEdit && (
              <div>
                <SectionTitle title="Community Intelligence" sub="Choose which intelligences serve this community and which is the default. An intelligence is a participant, never an authority — and always replaceable." />
                {intelligences.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center text-slate-400">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-500"><Icons.Sparkles /></div>
                    <p className="text-sm">No intelligences are available yet. A super-admin seeds the commons on first load.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {intelligences.map(intel => {
                      const available = editAvailableIntelligenceIds.includes(intel.id);
                      const isDefault = editDefaultIntelligenceId === intel.id;
                      return (
                        <div key={intel.id} className={`rounded-2xl border p-4 transition-all ${available ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200 bg-white'}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="break-words text-base font-bold text-slate-800">{intel.name}</h3>
                                {isDefault && <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">Default</span>}
                              </div>
                              {intel.description && <p className="mt-1 text-sm text-slate-500">{intel.description}</p>}
                              <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                                <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-slate-600">{PROVIDER_LABELS[intel.provider] || intel.provider}</span>
                                <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 font-mono text-slate-500">{intel.model}</span>
                                {personaName(intel.personaId) && <span className="rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-purple-700">Persona · {personaName(intel.personaId)}</span>}
                                <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-slate-500">{(intel.memoryIds || []).length} memory {(intel.memoryIds || []).length === 1 ? 'source' : 'sources'}</span>
                              </div>
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-2">
                              <button
                                type="button"
                                onClick={() => toggleAvailable(intel.id)}
                                className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${available ? 'bg-emerald-100 text-emerald-700 hover:bg-red-50 hover:text-red-600' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
                              >
                                {available ? 'Enabled' : 'Enable'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setDefaultIntelligence(intel.id)}
                                disabled={isDefault}
                                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${isDefault ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-700'}`}
                              >
                                {isDefault ? '★ Default' : 'Set default'}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="mt-6 flex items-center gap-3">
                  <button onClick={handleSaveIntelligence} disabled={isSavingIntel} className="rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 transition-all hover:bg-emerald-700 disabled:opacity-50">
                    {isSavingIntel ? 'Saving...' : 'Save Intelligence'}
                  </button>
                  {status && <span className="text-sm text-slate-500">{status}</span>}
                </div>
              </div>
            )}

            {activeTab === 'appearance' && canEdit && (
              <div>
                <SectionTitle title="Appearance" sub="Brand, logo, imagery and theme." />

                <div className="space-y-6">
                  <div className="grid gap-6 md:grid-cols-[160px_1fr]">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase text-slate-400">Logo</label>
                      <ImagePicker onImageSelect={handleLogoUpload} previewUrl={logoUrl} loading={isUploadingLogo} className="aspect-square w-full max-w-[160px] rounded-2xl border-2 border-dashed border-slate-200" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase text-slate-400">Community Name</label>
                      <input dir="auto" type="text" value={editName} onChange={e => setEditName(e.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Community name" />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-[10px] font-bold uppercase text-slate-400">Gallery</label>
                    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                      {imageUrls.map((url, index) => (
                        <div key={url} className="relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                          <img src={url} className="h-full w-full object-cover" alt={`Community image ${index + 1}`} />
                          <button type="button" onClick={() => handleRemoveImage(index)} className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-red-500 shadow-sm" title="Remove image">
                            <Icons.Close />
                          </button>
                        </div>
                      ))}
                      <ImagePicker onImageSelect={handleAddImage} loading={isUploadingImage} className="flex aspect-square cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 text-slate-400 hover:border-emerald-400 hover:text-emerald-600">
                        <Icons.Plus />
                      </ImagePicker>
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-[10px] font-bold uppercase text-slate-400">Theme mood</label>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {communityThemePresets.map((preset) => {
                        const active = !isCustomTheme && themeEquals(editTheme, preset);
                        return (
                          <button key={preset.id} type="button" onClick={() => { setEditTheme(normalizeTheme(preset)); setIsCustomTheme(false); }} className={`w-full rounded-2xl border p-3 text-left transition-all ${active ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}>
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="text-sm font-bold text-slate-800">{preset.name}</div>
                                <div className="text-[11px] text-slate-500">{preset.description}</div>
                              </div>
                              <div className="flex shrink-0 overflow-hidden rounded-full border border-white shadow-sm">
                                {[preset.surface, preset.primary, preset.accent, preset.background].map((color, index) => (
                                  <span key={`${preset.id}-${index}`} className="h-6 w-6" style={{ backgroundColor: color }} />
                                ))}
                              </div>
                            </div>
                          </button>
                        );
                      })}

                      {/* Custom theme — pick each colour separately and save. */}
                      <button type="button" onClick={() => setIsCustomTheme(true)} className={`w-full rounded-2xl border p-3 text-left transition-all ${isCustomTheme ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-bold text-slate-800">Custom</div>
                            <div className="text-[11px] text-slate-500">Choose every colour yourself.</div>
                          </div>
                          <div className="flex shrink-0 overflow-hidden rounded-full border border-white shadow-sm">
                            {[editTheme.surface, editTheme.primary, editTheme.accent, editTheme.background].map((color, index) => (
                              <span key={`custom-${index}`} className="h-6 w-6" style={{ backgroundColor: color }} />
                            ))}
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Per-colour pickers only appear in custom mode. */}
                  {isCustomTheme && (
                    <div className="space-y-4 rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase text-slate-400">Mode</span>
                        {(['light', 'dark'] as const).map(m => (
                          <button key={m} type="button" onClick={() => setEditTheme(normalizeTheme({ ...editTheme, mode: m }))} className={`rounded-full px-3 py-1 text-xs font-bold capitalize transition-colors ${editTheme.mode === m ? 'bg-emerald-600 text-white' : 'bg-white text-slate-500 border border-slate-200 hover:text-slate-800'}`}>
                            {m}
                          </button>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {([
                          ['surface', 'Header'],
                          ['primary', 'Primary'],
                          ['accent', 'Accent'],
                          ['background', 'Background'],
                          ['secondary', 'Secondary'],
                          ['neutral', 'Neutral'],
                          ['text', 'Text'],
                        ] as Array<[keyof CommunityThemePreset, string]>).map(([key, label]) => (
                          <label key={key} className="space-y-1">
                            <span className="text-[10px] font-bold uppercase text-slate-400">{label}</span>
                            <input type="color" value={(editTheme as any)[key]} onChange={e => setEditTheme(normalizeTheme({ ...editTheme, [key]: e.target.value }))} className="block h-10 w-full cursor-pointer rounded-lg border border-slate-200 bg-white p-1" />
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <SaveBar />
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};
