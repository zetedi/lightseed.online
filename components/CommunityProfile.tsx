
import React, { useState, useEffect, useMemo } from 'react';
import { showAlert, showConfirm } from "./ui/Dialog";
import { useLanguage } from '../contexts/LanguageContext';
import { Icons } from './ui/Icons';
import { Community, Lifetree, Lightseed, Pulse, Intelligence, Persona, Sanctuary } from '../types';
import { updateCommunity, uploadImage, getTreesByDomain, deleteCommunity, createCommunityEvent, updateEvent, deleteCommunityEvent, getCommunityByDomain, getCommunityEvents, getSanctuariesByDomain, createDecision, voteOnDecision, getDecisions } from '../services/firebase';
import { DECISION_NATURES, type Decision, type DecisionNature } from '../src/domain/decision';
import { getSelectableIntelligences, listPersonas } from '../services/intelligence';
import RichTextEditor from './ui/RichTextEditor';
import { ImagePicker } from './ui/ImagePicker';
import { DefaultCardImage } from './ui/DefaultCardImage';
import { normalizeTheme } from '../utils/theme';
import { AppearanceEditor } from './ui/AppearanceEditor';
import { IntelligencePanel } from './intelligence/IntelligencePanel';
import { LoreSection, loreTabs, type LoreTabId } from './about/AboutSections';
import { queryableLevels, visibilitiesForScope } from '../src/domain/pulseVisibility';
import { councilView } from '../src/domain/views/council';
import { firestoreStore } from '../src/adapters/firestore';
import { isParticipant } from '../src/domain/views/participation';
import { canTendTree } from '../src/domain/policy';
import type { PulseVisibility } from '../src/domain/pulse';

interface CommunityProfileProps {
  community: Community;
  onUpdate?: (updates: Partial<Community>) => void;
  onClose: () => void;
  onViewTree?: (tree: Lifetree) => void;
  // Open an event's page. Seeing an event implies at least viewer rights, so this is
  // offered to everyone — not gated behind edit permissions.
  onViewEvent?: (event: Pulse) => void;
  currentUser?: Lightseed | null;
  currentUserId?: string;
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
  // Superadmin only — "switch to community view": render the whole app as this community.
  onEnterCommunityView?: (community: Community) => void;
}

type TabKey = 'vision' | 'firsttree' | 'sanctuary' | 'trees' | 'events' | 'council' | LoreTabId | 'intelligence' | 'appearance';

const PROVIDER_LABELS: Record<string, string> = {
  google: 'Google · Gemini',
  openai: 'OpenAI',
  anthropic: 'Anthropic · Claude',
  deepseek: 'DeepSeek',
  local: 'Local model',
};

const bareDomain = (d?: string) => (d || '').toLowerCase().replace(/^www\./, '');

export const CommunityProfile: React.FC<CommunityProfileProps> = ({
  community,
  onUpdate,
  onClose,
  onViewTree,
  onViewEvent,
  currentUser,
  currentUserId,
  isAdmin,
  isSuperAdmin,
  onEnterCommunityView,
}) => {
  const { t } = useLanguage();
  const canEdit = currentUserId === community.ownerId || isSuperAdmin || isAdmin;
  const canDelete = currentUserId === community.ownerId || isSuperAdmin;

  // Membership as a prism over the LIN, read through the Store port (the adapter maps the
  // legacy memberIds → 'member' links). Seeded synchronously from the prop (`memberSeed`) so
  // the events/visibility flow is correct on first render with no flicker; the port-derived
  // value keeps it right once memberIds moves into a links collection.
  const memberSeed = !!currentUserId && (community.ownerId === currentUserId || (community.memberIds || []).includes(currentUserId));
  const [memberByLink, setMemberByLink] = useState(false);
  useEffect(() => {
    let alive = true;
    firestoreStore.linksTo(community.id, 'member')
      .then(links => { if (alive) setMemberByLink(isParticipant(links, currentUserId)); })
      .catch(() => {});
    return () => { alive = false; };
  }, [community.id, currentUserId]);
  const isMember = memberSeed || memberByLink;
  const eventLevels = queryableLevels(
    { uid: currentUserId, isStaff: isSuperAdmin || isAdmin, communityIds: isMember ? [community.id] : [] },
    { communityId: community.id },
  );

  const [activeTab, setActiveTab] = useState<TabKey>('vision');

  // Editable copies of the community fields (branding + vision).
  const [editName, setEditName] = useState(community.name);
  const [editVision, setEditVision] = useState(community.vision);
  const [editTheme, setEditTheme] = useState(normalizeTheme(community.theme));
  const [logoUrl, setLogoUrl] = useState(community.logoUrl || '');
  const [heroImageUrl, setHeroImageUrl] = useState(community.heroImageUrl || '');
  const [imageUrls, setImageUrls] = useState<string[]>(community.imageUrls || []);
  const [isUploadingHero, setIsUploadingHero] = useState(false);

  // Community Intelligence config
  const [intelligences, setIntelligences] = useState<Intelligence[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [editDefaultIntelligenceId, setEditDefaultIntelligenceId] = useState(community.defaultIntelligenceId || '');
  const [editAvailableIntelligenceIds, setEditAvailableIntelligenceIds] = useState<string[]>(community.availableIntelligenceIds || []);
  const [isSavingIntel, setIsSavingIntel] = useState(false);

  const [linkedTrees, setLinkedTrees] = useState<Lifetree[]>([]);
  const [sanctuaries, setSanctuaries] = useState<Sanctuary[]>([]);

  // Council — governance decisions
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [decTitle, setDecTitle] = useState('');
  const [decNature, setDecNature] = useState<DecisionNature>('intention');
  const [decBody, setDecBody] = useState('');
  const [proposing, setProposing] = useState(false);
  const [votingId, setVotingId] = useState<string | null>(null);
  const refreshDecisions = () => { getDecisions(community.id).then(setDecisions).catch(() => {}); };
  useEffect(() => { if (activeTab === 'council') refreshDecisions(); }, [activeTab, community.id]);

  const handlePropose = async () => {
    if (!currentUserId || !decTitle.trim()) return;
    setProposing(true);
    try {
      await createDecision(community, { nature: decNature, title: decTitle.trim(), body: decBody.trim(), proposedBy: currentUserId });
      setDecTitle(''); setDecBody(''); setDecNature('intention');
      refreshDecisions();
    } catch (e: any) { showAlert(e?.message || 'Could not propose the decision.'); }
    setProposing(false);
  };

  const handleVote = async (id: string) => {
    if (!currentUserId) { showAlert('Sign in to add your voice.'); return; }
    setVotingId(id);
    try { await voteOnDecision(id, currentUserId); refreshDecisions(); }
    catch (e: any) { showAlert(e?.message || 'Could not record your voice.'); }
    setVotingId(null);
  };
  const [togglingId, setTogglingId] = useState<string | null>(null);
  // Which trees the signed-in user guards — read from their outgoing 'guardian' links (the LIN),
  // not the legacy tree.guardians array (which writes no longer touch).
  const [guardedTreeIds, setGuardedTreeIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!currentUserId) { setGuardedTreeIds(new Set()); return; }
    let alive = true;
    firestoreStore.linksFrom(currentUserId, 'guardian')
      .then(links => { if (alive) setGuardedTreeIds(new Set(links.map(l => l.to))); })
      .catch(() => {});
    return () => { alive = false; };
  }, [currentUserId]);
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
  const [eventVisibility, setEventVisibility] = useState<PulseVisibility>('public');
  const [eventImageUrls, setEventImageUrls] = useState<string[]>([]);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [isEventSaving, setIsEventSaving] = useState(false);
  const [isUploadingEventImage, setIsUploadingEventImage] = useState(false);
  const [showEventForm, setShowEventForm] = useState(false);

  const handleDeleteEvent = async (eventId: string) => {
    if (!(await showConfirm(t('delete_event_confirm'), { title: t('delete'), confirmText: t('delete'), danger: true }))) return;
    try {
      await deleteCommunityEvent(eventId);
      setEvents(prev => prev.filter(e => e.id !== eventId));
    } catch (e: any) {
      showAlert(e?.message || 'Could not delete the event.');
    }
  };

  // Keep editable copies in sync whenever the community prop changes (e.g. after refresh).
  useEffect(() => {
    setEditName(community.name);
    setEditVision(community.vision);
    setEditTheme(normalizeTheme(community.theme));
    setLogoUrl(community.logoUrl || '');
    setHeroImageUrl(community.heroImageUrl || '');
    setImageUrls(community.imageUrls || []);
    setEditDefaultIntelligenceId(community.defaultIntelligenceId || '');
    setEditAvailableIntelligenceIds(community.availableIntelligenceIds || []);
  }, [community.id, community.name, community.vision, community.logoUrl, community.heroImageUrl, community.theme, (community.imageUrls || []).join(','), community.defaultIntelligenceId, (community.availableIntelligenceIds || []).join(',')]);

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
    getCommunityEvents(community.id, eventLevels).then(setEvents).catch(() => {});
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

  // Featured tree's guardian count — a prism over its incoming 'guardian' links.
  const [firstTreeGuardians, setFirstTreeGuardians] = useState(0);
  useEffect(() => {
    if (!firstTree) { setFirstTreeGuardians(0); return; }
    let alive = true;
    firestoreStore.linksTo(firstTree.id, 'guardian')
      .then(links => { if (alive) setFirstTreeGuardians(links.length); })
      .catch(() => {});
    return () => { alive = false; };
  }, [firstTree?.id, guardedTreeIds]);

  const isGuardian = (tree: Lifetree) => guardedTreeIds.has(tree.id);

  const handleToggleGuardian = async (tree: Lifetree) => {
    if (!canTendTree(currentUserId)) { showAlert('Sign in to join a guardianship.'); return; }
    const join = !isGuardian(tree);
    setTogglingId(tree.id);
    try {
      await (join ? firestoreStore.link(currentUserId, 'guardian', tree.id) : firestoreStore.unlink(currentUserId, 'guardian', tree.id));
      setGuardedTreeIds(prev => {
        const next = new Set(prev);
        if (join) next.add(tree.id); else next.delete(tree.id);
        return next;
      });
    } catch (e) {
      console.error(e);
      showAlert('Failed to update guardianship.');
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
        heroImageUrl,
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
    if (!(await showConfirm('Are you sure you want to delete this community? This cannot be undone.', { title: 'Delete Community', confirmText: 'Delete', danger: true }))) return;
    setIsDeleting(true);
    try {
      await deleteCommunity(community.id);
      onClose();
      window.location.reload();
    } catch (e) {
      console.error(e);
      showAlert('Failed to delete community.');
    }
    setIsDeleting(false);
  };

  const handleLogoUpload = async (file: File) => {
    setIsUploadingLogo(true);
    try {
      const url = await uploadImage(file, `communities/${community.id}/logo_${Date.now()}`);
      setLogoUrl(url);
      // Persist immediately so the change can't get lost before the next Save.
      await updateCommunity(community.id, { logoUrl: url });
      onUpdate?.({ logoUrl: url });
      setStatus('Saved');
    } catch (e: any) {
      console.error(e);
      setStatus(e?.message || 'Failed to upload logo.');
    }
    setIsUploadingLogo(false);
  };

  const handleHeroUpload = async (file: File) => {
    setIsUploadingHero(true);
    try {
      const url = await uploadImage(file, `communities/${community.id}/hero_${Date.now()}`);
      setHeroImageUrl(url);
      await updateCommunity(community.id, { heroImageUrl: url });
      onUpdate?.({ heroImageUrl: url });
      setStatus('Saved');
    } catch (e: any) {
      console.error(e);
      setStatus(e?.message || 'Failed to upload hero image.');
    }
    setIsUploadingHero(false);
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
      showAlert('Failed to upload event image.');
    }
    setIsUploadingEventImage(false);
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserId || !eventTitle.trim() || isEventSaving) return;
    setIsEventSaving(true);
    try {
      const payload = {
        title: eventTitle.trim(),
        body: eventBody.trim(),
        content: eventBody.trim(),
        imageUrl: eventImageUrls[0] || '',
        imageUrls: eventImageUrls,
        eventDate: eventDate || '',
        eventLocation: eventLocation.trim(),
        visibility: eventVisibility,
      };
      if (editingEventId) {
        await updateEvent(editingEventId, payload); // author preserved
      } else {
        await createCommunityEvent(community, {
          ...payload,
          authorId: currentUserId,
          authorName: currentUser?.displayName || 'Community Admin',
          authorPhoto: currentUser?.photoURL || undefined,
        });
      }
      setEventTitle('');
      setEventDate('');
      setEventLocation('');
      setEventBody('');
      setEventVisibility('public');
      setEventImageUrls([]);
      setEditingEventId(null);
      setShowEventForm(false);
      getCommunityEvents(community.id, eventLevels).then(setEvents).catch(() => {});
    } catch (error: any) {
      console.error(error);
      showAlert('Failed to save event: ' + (error.message || 'Unknown error'));
    }
    setIsEventSaving(false);
  };

  // Begin editing an existing event: prefill the form and reveal it.
  const startEditEvent = (ev: Pulse) => {
    setEditingEventId(ev.id);
    setEventTitle(ev.title || '');
    setEventBody(ev.content || ev.body || '');
    setEventDate(ev.eventDate || '');
    setEventLocation(ev.eventLocation || '');
    setEventVisibility((ev.visibility as PulseVisibility) || 'public');
    setEventImageUrls(ev.imageUrls?.length ? ev.imageUrls : (ev.imageUrl ? [ev.imageUrl] : []));
    setShowEventForm(true);
  };

  // Icons for the shared network-lore tabs (Path, Yantra).
  const loreIcons: Record<LoreTabId, React.ReactNode> = {
    genesis: <Icons.Hash />,
    path: <Icons.ArrowRight />,
    yantra: <Icons.Venn />,
  };

  // The Yantra (and the network's deeper lore) only belongs to the central nodes.
  const isNetworkHub = ['lightseed.online', 'lifeseed.online'].includes(bareDomain(community.domain));

  const navSections: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'vision', label: 'Vision', icon: <Icons.FingerPrint /> },
    { key: 'firsttree', label: 'First Tree', icon: <Icons.Tree /> },
    { key: 'sanctuary', label: 'The Sanctuary', icon: <Icons.Sun /> },
    { key: 'trees', label: 'Community Trees', icon: <Icons.Tree /> },
    { key: 'events', label: 'Events', icon: <Icons.Loc /> },
    { key: 'council', label: t('council'), icon: <Icons.Venn /> },
    // The network's foundational story travels to every node's about page (the Yantra
    // stays with the central lightseed / lifeseed nodes).
    ...loreTabs.filter(tab => isNetworkHub || tab.id !== 'yantra').map(tab => ({ key: tab.id as TabKey, label: tab.label, icon: loreIcons[tab.id] })),
    ...(canEdit ? [
      { key: 'intelligence' as TabKey, label: 'Intelligence', icon: <Icons.Sparkles /> },
      { key: 'appearance' as TabKey, label: 'Appearance', icon: <Icons.Image /> },
    ] : []),
  ];

  const isLoreTab = (key: TabKey): key is LoreTabId => loreTabs.some(tab => tab.id === key);

  const SectionTitle = ({ title, sub }: { title: string; sub?: string }) => (
    <div className="mb-6">
      <h2 className="text-base sm:text-xl font-bold text-slate-900">{title}</h2>
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
      <div className="relative overflow-hidden bg-gradient-to-b from-slate-800 to-slate-900 text-white pt-5 pb-12 px-4">
        {(heroImageUrl || community.imageUrls?.[0]) && (
          <>
            <img src={heroImageUrl || community.imageUrls?.[0]} alt={`${community.name} banner`} referrerPolicy="no-referrer" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-b from-slate-900/55 via-slate-900/65 to-slate-900/85" />
          </>
        )}
        <div className="relative max-w-6xl mx-auto flex items-center justify-between mb-6">
          <button onClick={onClose} className="flex items-center gap-2 text-white/70 hover:text-white text-sm font-medium">
            <Icons.ArrowLeft />
            <span>Back</span>
          </button>
          <div className="flex items-center gap-2">
            {onEnterCommunityView && (
              <button onClick={() => onEnterCommunityView(community)} className="flex items-center gap-1 rounded-full border border-amber-300/40 bg-amber-400/15 px-4 py-2 text-xs font-bold text-amber-200 transition-colors hover:bg-amber-400 hover:text-white" title="See the whole site as this community">
                <Icons.Eye /><span className="hidden sm:inline">Switch to community view</span><span className="sm:hidden">Community view</span>
              </button>
            )}
            {canDelete && (
              <button onClick={handleDelete} disabled={isDeleting} className="bg-red-500/15 hover:bg-red-500 text-red-300 hover:text-white px-4 py-2 rounded-full font-bold text-xs transition-colors flex items-center gap-1 border border-red-400/30">
                <Icons.Trash /><span>Delete</span>
              </button>
            )}
          </div>
        </div>

        <div className="relative max-w-6xl mx-auto flex flex-col sm:flex-row items-center gap-4 sm:gap-5">
          <div className="flex h-16 w-16 md:h-20 md:w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-white shadow-xl">
            {logoUrl ? (
              <img src={logoUrl} className="h-full w-full object-cover" alt={`${community.name} logo`} referrerPolicy="no-referrer" />
            ) : (
              <span className="text-slate-300"><Icons.Globe /></span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            {/* Name + all meta on one wrapping row */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 justify-center sm:justify-start">
              <h1 className="min-w-0 break-words text-2xl font-light tracking-wide">{community.name}</h1>
              <span className="inline-flex items-baseline gap-1 text-slate-300">
                <span className="text-base font-bold text-white">{domainTrees.length}</span>
                <span className="text-xs text-slate-400">{domainTrees.length === 1 ? t('tree') : t('trees')}</span>
              </span>
              <a href={`https://${community.domain}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2.5 py-0.5 text-xs font-mono text-emerald-300 hover:bg-emerald-400/20">
                <Icons.Globe size={12} /> {community.domain}
              </a>
              <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-0.5 text-xs text-slate-300">
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
            <div className="rounded-xl border border-slate-100 bg-white p-2.5 shadow-lg lg:sticky lg:top-24">
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

          <main className="rounded-xl border border-slate-100 bg-white p-4 sm:p-6 shadow-lg min-h-[520px]">
            {activeTab === 'vision' && (
              <div>
                <SectionTitle title="Vision" sub="What this community is growing towards." />
                {canEdit ? (
                  <>
                    <RichTextEditor value={editVision} onChange={setEditVision} placeholder="Share your community's vision..." />
                    <SaveBar />
                  </>
                ) : (
                  <div className="prose prose-slate max-w-none text-slate-700 leading-relaxed break-words [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg" dangerouslySetInnerHTML={{ __html: community.vision || '<p>No vision shared yet.</p>' }} />
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
                        {firstTreeGuardians} {firstTreeGuardians === 1 ? 'guardian' : 'guardians'}
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
                          {tree.latestGrowthUrl || tree.imageUrl ? <img src={tree.latestGrowthUrl || tree.imageUrl} className="h-full w-full object-cover" alt={tree.name} /> : <DefaultCardImage />}
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
                <div className="mb-4 flex items-center justify-between gap-3">
                  <SectionTitle title={t('events')} sub={t('events_sub')} />
                  {canEdit && (
                    <button onClick={() => { const next = !showEventForm; setShowEventForm(next); if (!next) setEditingEventId(null); }} className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-sky-600 px-4 py-2 text-xs font-bold text-white shadow-md transition-colors hover:bg-sky-700">
                      {showEventForm ? <Icons.Close /> : <Icons.Plus />}<span>{editingEventId ? t('edit_event') : t('create_event')}</span>
                    </button>
                  )}
                </div>

                {canEdit && showEventForm && (
                  <form onSubmit={handleCreateEvent} className="mb-8 space-y-3 rounded-2xl border border-slate-100 bg-slate-50/50 p-5">
                    <input dir="auto" value={eventTitle} onChange={e => setEventTitle(e.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder={t('event_title_ph')} required />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input type="datetime-local" value={eventDate} onChange={e => setEventDate(e.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                      <input dir="auto" value={eventLocation} onChange={e => setEventLocation(e.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder={t('location')} />
                    </div>
                    <textarea dir="auto" value={eventBody} onChange={e => setEventBody(e.target.value)} className="min-h-24 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder={t('event_details_ph')} />
                    <label className="block">
                      <span className="mb-1 block text-[10px] font-bold uppercase text-slate-400">{t('visibility')}</span>
                      <select value={eventVisibility} onChange={e => setEventVisibility(e.target.value as PulseVisibility)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                        {visibilitiesForScope('community').map(v => <option key={v} value={v}>{t(`vis_${v}` as any)}</option>)}
                      </select>
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {eventImageUrls.map((url, index) => (
                        <div key={url} className="relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                          <img src={url} className="h-full w-full object-cover" alt={`Event image ${index + 1}`} />
                          <button type="button" onClick={() => setEventImageUrls(prev => prev.filter((_, i) => i !== index))} className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-red-500 shadow-sm" title={t('remove')}>
                            <Icons.Close />
                          </button>
                        </div>
                      ))}
                      <ImagePicker onImageSelect={handleAddEventImage} loading={isUploadingEventImage} className="flex aspect-square cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-white text-slate-400 hover:border-emerald-400 hover:text-emerald-600">
                        <Icons.Plus />
                      </ImagePicker>
                    </div>
                    <button type="submit" disabled={isEventSaving || isUploadingEventImage || !eventTitle.trim()} className="w-full rounded-2xl bg-sky-600 py-3 text-sm font-bold text-white shadow-lg shadow-sky-600/20 transition-all hover:bg-sky-700 disabled:opacity-50">
                      {isEventSaving ? t('creating') : (editingEventId ? t('save_changes') : t('create_event'))}
                    </button>
                  </form>
                )}

                {events.length === 0 ? (
                  <p className="text-center text-slate-400 py-10 text-sm">{t('no_events')}</p>
                ) : (
                  <div className="space-y-3">
                    {events.map(ev => (
                      <div
                        key={ev.id}
                        onClick={() => onViewEvent?.(ev)}
                        className={`group flex items-center gap-4 rounded-xl border border-slate-100 bg-white p-3 shadow-sm ${onViewEvent ? 'cursor-pointer transition-shadow hover:shadow-md' : ''}`}
                      >
                        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                          {ev.imageUrl ? <img src={ev.imageUrl} className="h-full w-full object-cover" alt={ev.title} /> : <DefaultCardImage />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="break-words text-sm font-bold text-slate-800">{ev.title}</p>
                          <p className="truncate text-xs text-slate-500">
                            {ev.eventDate ? new Date(ev.eventDate).toLocaleString() : ''}{ev.eventLocation ? ` · ${ev.eventLocation}` : ''}
                          </p>
                        </div>
                        {(canEdit || ev.authorId === currentUserId) && (
                          <button onClick={(e) => { e.stopPropagation(); startEditEvent(ev); }} title={t('edit')} className="shrink-0 rounded-full p-2 text-slate-400 transition-colors hover:bg-sky-50 hover:text-sky-600 sm:opacity-0 sm:group-hover:opacity-100">
                            <Icons.Pencil />
                          </button>
                        )}
                        {canEdit && (
                          <button onClick={(e) => { e.stopPropagation(); handleDeleteEvent(ev.id); }} title={t('delete')} className="shrink-0 rounded-full p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 sm:opacity-0 sm:group-hover:opacity-100">
                            <Icons.Trash />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'council' && (
              <div>
                <SectionTitle title={t('council')} sub={t('council_sub')} />

                {currentUserId && (
                  <div className="mb-8 space-y-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                    <h4 className="text-sm font-bold text-slate-700">{t('propose_decision')}</h4>
                    <input value={decTitle} onChange={e => setDecTitle(e.target.value)} placeholder={t('decision_title_ph')} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    <label className="block space-y-1">
                      <span className="text-[10px] font-bold uppercase text-slate-400">{t('decision_nature')}</span>
                      <select value={decNature} onChange={e => setDecNature(e.target.value as DecisionNature)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 sm:max-w-xs">
                        {DECISION_NATURES.map(n => <option key={n.id} value={n.id}>{t(('nature_' + n.id) as any)} · {n.votes} {t('voices')}</option>)}
                      </select>
                    </label>
                    <textarea value={decBody} onChange={e => setDecBody(e.target.value)} placeholder={t('decision_body_ph')} className="min-h-20 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    <button onClick={handlePropose} disabled={proposing || !decTitle.trim()} className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">{proposing ? '…' : t('propose')}</button>
                  </div>
                )}

                {decisions.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-400">{t('no_decisions')}</p>
                ) : (
                  <div className="space-y-3">
                    {councilView(decisions, currentUserId).map(d => (
                        <div key={d.id} className={`rounded-2xl border p-4 ${d.passed ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200 bg-white'}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="text-sm font-bold text-slate-800">{d.title}</h4>
                                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-500">{t(('nature_' + d.nature) as any)}</span>
                                {d.passed
                                  ? <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">{t('passed')}</span>
                                  : <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700">{t('decision_open')}</span>}
                              </div>
                              {d.body && <p className="mt-1 text-xs italic text-slate-500">{d.body}</p>}
                              <div className="mt-2 text-[11px] font-bold text-slate-400">{d.voiceCount} / {d.voicesRequired} {t('voices')}</div>
                            </div>
                            {!d.passed && (
                              <button onClick={() => handleVote(d.id)} disabled={votingId === d.id || d.voted} className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors disabled:opacity-50 ${d.voted ? 'bg-slate-100 text-slate-400' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}>
                                {d.voted ? t('voted') : (votingId === d.id ? '…' : t('vote'))}
                              </button>
                            )}
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

                <div className="mb-8">
                  <IntelligencePanel
                    scope="community"
                    credentialOwnerId={community.id}
                    intelligenceOwnerUid={community.ownerId}
                    viewerUid={currentUserId}
                    canManageAll={!!canEdit}
                    selectedIntelligenceId={editDefaultIntelligenceId}
                    title={t('intel_community_title')}
                    subtitle={t('intel_community_sub')}
                    onSelect={(id) => {
                      setEditDefaultIntelligenceId(id);
                      const nextAvailable = Array.from(new Set([...editAvailableIntelligenceIds, id]));
                      setEditAvailableIntelligenceIds(nextAvailable);
                      updateCommunity(community.id, { defaultIntelligenceId: id, availableIntelligenceIds: nextAvailable }).catch(() => {});
                    }}
                  />
                </div>

                <h4 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-400">All available intelligences</h4>
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
                <div className="flex items-start justify-between gap-3">
                  <SectionTitle title={t('appearance')} sub="Brand, logo, imagery and theme." />
                  <div className="flex shrink-0 items-center gap-2">
                    <button onClick={handleSave} disabled={isSaving || isUploadingLogo || isUploadingImage} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 transition-all hover:bg-emerald-700 disabled:opacity-50">
                      {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                    {status && <span className="text-xs text-slate-500">{status}</span>}
                  </div>
                </div>

                <AppearanceEditor
                  theme={editTheme}
                  onThemeChange={setEditTheme}
                  logoUrl={logoUrl}
                  onLogoUpload={handleLogoUpload}
                  uploadingLogo={isUploadingLogo}
                  heroUrl={heroImageUrl}
                  onHeroUpload={handleHeroUpload}
                  uploadingHero={isUploadingHero}
                  onRemoveHero={() => setHeroImageUrl('')}
                  heroHint={t('hero_hint_community')}
                  name={editName}
                  onNameChange={setEditName}
                  imageUrls={imageUrls}
                  onAddImage={handleAddImage}
                  onRemoveImage={handleRemoveImage}
                  uploadingImage={isUploadingImage}
                />
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};
