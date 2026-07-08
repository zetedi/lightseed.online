
import React, { useState, useEffect, useMemo } from 'react';
import { showAlert, showConfirm } from "./ui/Dialog";
import { useLanguage } from '../contexts/LanguageContext';
import { useSession } from '../contexts/SessionContext';
import { Icons } from './ui/Icons';
import { Community, Lifetree, Pulse, Sanctuary } from '../types';
import { updateCommunity, uploadImage, getTreesByDomain, getParticipatingTrees, deleteCommunity, getCommunityByDomain, getSanctuariesByDomain } from '../services/firebase';
import { CommunityVision } from './community/CommunityVision';
import { CommunityCouncil } from './community/CommunityCouncil';
import { CommunityEvents } from './community/CommunityEvents';
import { CommunityFirstTree } from './community/CommunityFirstTree';
import { CommunitySanctuary } from './community/CommunitySanctuary';
import { CommunityTreesTab } from './community/CommunityTreesTab';
import { CommunityIntelligence } from './community/CommunityIntelligence';
import { CommunityAppearance } from './community/CommunityAppearance';
import { SectionMenu } from './ui/SectionMenu';
import { ProfileHero } from './ui/ProfileHero';
import { ProfileLayout } from './ui/ProfileLayout';
import { SectionTitle } from './ui/SectionTitle';
import { normalizeTheme } from '../utils/theme';
import { LoreSection, loreTabs, type LoreTabId } from './about/AboutSections';
import { NodeGrowthTree } from './about/NodeGrowthTree';
import { queryableLevels } from '../domain/pulseVisibility';
import { firestoreStore } from '../adapters/firestore';
import { isParticipant } from '../domain/views/participation';
import { canTendTree } from '../domain/policy';

interface CommunityProfileProps {
  community: Community;
  onUpdate?: (updates: Partial<Community>) => void;
  onClose: () => void;
  onViewTree?: (tree: Lifetree) => void;
  // Open an event's page. Seeing an event implies at least viewer rights, so this is
  // offered to everyone — not gated behind edit permissions.
  onViewEvent?: (event: Pulse) => void;
  // Superadmin only — "switch to community view": render the whole app as this community.
  onEnterCommunityView?: (community: Community) => void;
}

type TabKey = 'vision' | 'firsttree' | 'sanctuary' | 'trees' | 'model' | 'events' | 'council' | LoreTabId | 'intelligence' | 'appearance';

const bareDomain = (d?: string) => (d || '').toLowerCase().replace(/^www\./, '');

export const CommunityProfile: React.FC<CommunityProfileProps> = ({
  community,
  onUpdate,
  onClose,
  onViewTree,
  onViewEvent,
  onEnterCommunityView,
}) => {
  const { t } = useLanguage();
  // Session-derived values from context (were prop-drilled from App).
  const { lightseed, isAdmin, isSuperAdmin } = useSession();
  const currentUser = lightseed;
  const currentUserId = lightseed?.uid;
  const canEdit = currentUserId === community.ownerId || isSuperAdmin || isAdmin;
  const canDelete = currentUserId === community.ownerId || isSuperAdmin;

  // Membership is a prism over the LIN ('member' links), read through the Store port. The owner
  // is implicitly a member (seeded synchronously so first render is correct); everyone else is
  // resolved from links below. Legacy memberIds arrays are no longer read.
  const memberSeed = !!currentUserId && community.ownerId === currentUserId;
  const [memberByLink, setMemberByLink] = useState(false);
  useEffect(() => {
    let alive = true;
    firestoreStore.linksTo(community.id, 'member')
      .then(links => { if (alive) setMemberByLink(isParticipant(links, currentUserId)); })
      .catch(() => {});
    return () => { alive = false; };
  }, [community.id, currentUserId]);
  const isMember = memberSeed || memberByLink;
  // The visibility levels this viewer may query at community scope — shared by the events and
  // council (decisions) tabs, so a signed-out viewer only ever requests public docs. Memoized so
  // the tab components can safely depend on it without refetching every render.
  const communityLevels = useMemo(() => queryableLevels(
    { uid: currentUserId, isStaff: isSuperAdmin || isAdmin, communityIds: isMember ? [community.id] : [] },
    { communityId: community.id },
  ), [currentUserId, isSuperAdmin, isAdmin, isMember, community.id]);

  const [activeTab, setActiveTab] = useState<TabKey>('vision');

  // Editable copies of the community fields (branding + vision).
  const [editName, setEditName] = useState(community.name);
  const [editVision, setEditVision] = useState(community.vision);
  const [editSocial, setEditSocial] = useState<{ instagram?: string; telegram?: string; whatsapp?: string; website?: string }>(community.socialLinks || {});
  const [editCarouselQuotes, setEditCarouselQuotes] = useState<string[]>(community.carouselQuotes || []);
  const [editTheme, setEditTheme] = useState(normalizeTheme(community.theme));
  const [logoUrl, setLogoUrl] = useState(community.logoUrl || '');
  const [heroImageUrl, setHeroImageUrl] = useState(community.heroImageUrl || '');
  const [imageUrls, setImageUrls] = useState<string[]>(community.imageUrls || []);
  const [isUploadingHero, setIsUploadingHero] = useState(false);

  const [linkedTrees, setLinkedTrees] = useState<Lifetree[]>([]);
  // Trees that joined this community via 'participant' links (invited, or self-joined).
  const [participatingTrees, setParticipatingTrees] = useState<Lifetree[]>([]);
  const [sanctuaries, setSanctuaries] = useState<Sanctuary[]>([]);

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

  // Keep editable copies in sync whenever the community prop changes (e.g. after refresh).
  useEffect(() => {
    setEditName(community.name);
    setEditVision(community.vision);
    setEditSocial(community.socialLinks || {});
    setEditTheme(normalizeTheme(community.theme));
    setLogoUrl(community.logoUrl || '');
    setHeroImageUrl(community.heroImageUrl || '');
    setImageUrls(community.imageUrls || []);
  }, [community.id, community.name, community.vision, community.logoUrl, community.heroImageUrl, community.theme, (community.imageUrls || []).join(',')]);

  useEffect(() => {
    getTreesByDomain(community.domain, currentUserId).then(setLinkedTrees).catch(() => {});
  }, [community.domain, currentUserId]);

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

  // Load the trees standing with this community via participant links.
  useEffect(() => {
    let alive = true;
    getParticipatingTrees(community.id).then(ts => { if (alive) setParticipatingTrees(ts); }).catch(() => {});
    return () => { alive = false; };
  }, [community.id]);

  // The trees tab shows domain trees + participating trees, deduped.
  const communityTrees = useMemo(() => {
    const byId = new Map<string, Lifetree>();
    domainTrees.forEach(t => byId.set(t.id, t));
    participatingTrees.forEach(t => byId.set(t.id, t));
    return Array.from(byId.values());
  }, [domainTrees, participatingTrees]);

  const handleToggleGuardian = async (tree: Lifetree) => {
    if (!canTendTree(currentUserId)) { showAlert('Sign in to join a guardianship.'); return; }
    const join = !guardedTreeIds.has(tree.id);
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
        socialLinks: editSocial,
        carouselQuotes: editCarouselQuotes.map(q => q.trim()).filter(Boolean),
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

  const handleRemoveHero = () => {
    // Persist immediately (like upload does) — otherwise the old photo returns
    // unless the user also remembers to hit Save.
    setHeroImageUrl('');
    updateCommunity(community.id, { heroImageUrl: '' }).catch(() => {});
    onUpdate?.({ heroImageUrl: '' });
  };

  // Icons for the shared network-lore tabs (Path, Yantra).
  const loreIcons: Record<LoreTabId, React.ReactNode> = {
    genesis: <Icons.Hash />,
    path: <Icons.ArrowRight />,
    yantra: <Icons.Venn />,
    protection: <Icons.ShieldCheck />,
  };

  // The Yantra (and the network's deeper lore) only belongs to the central nodes.
  const isNetworkHub = ['lightseed.online', 'lifeseed.online'].includes(bareDomain(community.domain));

  const navSections: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'vision', label: 'Vision', icon: <Icons.Eye /> },
    { key: 'firsttree', label: 'First Tree', icon: <Icons.Tree /> },
    { key: 'sanctuary', label: 'The Sanctuary', icon: <Icons.Sun /> },
    { key: 'trees', label: 'Community Trees', icon: <Icons.Tree /> },
    { key: 'model', label: 'Growth', icon: <Icons.Sparkles /> },
    { key: 'events', label: 'Events', icon: <Icons.Loc /> },
    { key: 'council', label: t('council'), icon: <Icons.Venn /> },
    // The network's founding lore (Genesis, the Path, the Yantra, Protection) stays with the
    // central lightseed / lifeseed nodes — every community will have its own genesis and path.
    ...loreTabs.filter(() => isNetworkHub).map(tab => ({ key: tab.id as TabKey, label: tab.label, icon: loreIcons[tab.id] })),
    ...(canEdit ? [
      { key: 'intelligence' as TabKey, label: 'Intelligence', icon: <Icons.Wizard /> },
      { key: 'appearance' as TabKey, label: 'Appearance', icon: <Icons.Image /> },
    ] : []),
  ];

  const isLoreTab = (key: TabKey): key is LoreTabId => loreTabs.some(tab => tab.id === key);

  return (
    <div className="min-h-screen pb-20">
      {/* Hero — mirrors the personal profile */}
      {/* Only the chosen hero — no gallery fallback, so removing the hero actually removes it. */}
      <ProfileHero heroImageUrl={heroImageUrl} padding="pt-5 pb-12 px-4">
        <div className="flex items-center justify-between mb-6">
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

        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-5">
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
      </ProfileHero>

      {/* Body: sidebar + content */}
      <ProfileLayout menu={<SectionMenu items={navSections} active={activeTab} onSelect={(k) => setActiveTab(k as TabKey)} />}>
            {activeTab === 'vision' && (
              <CommunityVision
                community={community}
                canEdit={canEdit}
                isSuperAdmin={isSuperAdmin}
                currentUserId={currentUserId}
                firstTree={firstTree}
                linkedTrees={linkedTrees}
                editVision={editVision}
                onVisionChange={setEditVision}
                onSave={handleSave}
                isSaving={isSaving}
                saveDisabled={isSaving || isUploadingLogo || isUploadingImage}
                status={status}
                onUpdate={onUpdate}
              />
            )}

            {activeTab === 'firsttree' && (
              <CommunityFirstTree
                community={community}
                firstTree={firstTree}
                onViewTree={onViewTree}
                guardedTreeIds={guardedTreeIds}
                togglingId={togglingId}
                onToggleGuardian={handleToggleGuardian}
              />
            )}

            {activeTab === 'sanctuary' && (
              <CommunitySanctuary community={community} sanctuary={firstSanctuary} />
            )}

            {activeTab === 'trees' && (
              <CommunityTreesTab
                community={community}
                currentUserId={currentUserId}
                communityTrees={communityTrees}
                onViewTree={onViewTree}
                guardedTreeIds={guardedTreeIds}
                togglingId={togglingId}
                onToggleGuardian={handleToggleGuardian}
              />
            )}

            {activeTab === 'model' && (
              <div>
                <SectionTitle title="Growth" sub="How this node is crystallising — its trees weighted by their chain growth, links and pulses." />
                <NodeGrowthTree community={community} trees={domainTrees} onViewTree={onViewTree} />
              </div>
            )}

            {activeTab === 'events' && (
              <CommunityEvents
                community={community}
                canEdit={canEdit}
                currentUserId={currentUserId}
                currentUserName={currentUser?.displayName}
                currentUserPhoto={currentUser?.photoURL}
                communityLevels={communityLevels}
                onViewEvent={onViewEvent}
              />
            )}

            {activeTab === 'council' && (
              <CommunityCouncil community={community} canEdit={canEdit} currentUserId={currentUserId} communityLevels={communityLevels} />
            )}

            {isLoreTab(activeTab) && <LoreSection id={activeTab} />}

            {activeTab === 'intelligence' && canEdit && (
              <CommunityIntelligence community={community} canEdit={canEdit} currentUserId={currentUserId} onUpdate={onUpdate} />
            )}

            {activeTab === 'appearance' && canEdit && (
              <CommunityAppearance
                community={community}
                editName={editName}
                onNameChange={setEditName}
                editTheme={editTheme}
                onThemeChange={setEditTheme}
                logoUrl={logoUrl}
                onLogoUpload={handleLogoUpload}
                uploadingLogo={isUploadingLogo}
                heroImageUrl={heroImageUrl}
                onHeroUpload={handleHeroUpload}
                uploadingHero={isUploadingHero}
                onRemoveHero={handleRemoveHero}
                imageUrls={imageUrls}
                onAddImage={handleAddImage}
                onRemoveImage={handleRemoveImage}
                uploadingImage={isUploadingImage}
                editSocial={editSocial}
                onSocialChange={setEditSocial}
                editCarouselQuotes={editCarouselQuotes}
                onCarouselQuotesChange={setEditCarouselQuotes}
                onSave={handleSave}
                isSaving={isSaving}
                saveDisabled={isSaving || isUploadingLogo || isUploadingImage}
                status={status}
              />
            )}
      </ProfileLayout>
    </div>
  );
};
