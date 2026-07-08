
import React, { useState, useEffect, useMemo } from 'react';
import { showAlert, showConfirm } from "./ui/Dialog";
import { useLanguage } from '../contexts/LanguageContext';
import { useSession } from '../contexts/SessionContext';
import { Icons } from './ui/Icons';
import { Community, Lifetree, Pulse, Intelligence, Persona, Sanctuary } from '../types';
import { updateCommunity, uploadImage, getTreesByDomain, getParticipatingTrees, fetchAllLifetrees, inviteTreeToCommunity, deleteCommunity, createCommunityEvent, updateEvent, deleteCommunityEvent, getCommunityByDomain, getCommunityEvents, getSanctuariesByDomain, createDecision, voteOnDecision, getDecisions, raiseConcern, resumeDecision, withdrawDecision, recordPosition, discernDecision, getPulsesByTreeId } from '../services/firebase';
import { isCanonicallySealed, verifyBlockSeal, type ChainBlock } from '../domain/chain';
import { setTokenisationEnabled } from '../domain/tokenisation';
import { DECISION_NATURES, decisionStatusLabels, consensusStanceLabels, votesRequired, type Decision, type DecisionNature, type DecisionMode, type ConsensusStance } from '../domain/decision';
import { getSelectableIntelligences, listPersonas } from '../services/intelligence';
import RichTextEditor from './ui/RichTextEditor';
import { ImagePicker } from './ui/ImagePicker';
import { SectionMenu } from './ui/SectionMenu';
import { ProfileHero } from './ui/ProfileHero';
import { ProfileLayout } from './ui/ProfileLayout';
import { SectionTitle } from './ui/SectionTitle';
import { tabTone } from '../utils/tabTheme';
import { normalizeTheme } from '../utils/theme';
import { sanitizeRichText } from '../utils/sanitize';
import { nodeDefaultTheme } from '../hooks/useConfig';
import { AppearanceEditor } from './ui/AppearanceEditor';
import { IntelligencePanel } from './intelligence/IntelligencePanel';
import { LoreSection, loreTabs, type LoreTabId } from './about/AboutSections';
import { NodeGrowthTree } from './about/NodeGrowthTree';
import { queryableLevels, visibilitiesForScope } from '../domain/pulseVisibility';
import { councilView } from '../domain/views/council';
import { firestoreStore } from '../adapters/firestore';
import { isParticipant } from '../domain/views/participation';
import { canTendTree } from '../domain/policy';
import type { PulseVisibility } from '../domain/pulse';

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
  // council (decisions) tabs, so a signed-out viewer only ever requests public docs.
  const communityLevels = queryableLevels(
    { uid: currentUserId, isStaff: isSuperAdmin || isAdmin, communityIds: isMember ? [community.id] : [] },
    { communityId: community.id },
  );

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

  // Community Intelligence config
  const [intelligences, setIntelligences] = useState<Intelligence[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [editDefaultIntelligenceId, setEditDefaultIntelligenceId] = useState(community.defaultIntelligenceId || '');
  const [editAvailableIntelligenceIds, setEditAvailableIntelligenceIds] = useState<string[]>(community.availableIntelligenceIds || []);
  const [isSavingIntel, setIsSavingIntel] = useState(false);

  const [linkedTrees, setLinkedTrees] = useState<Lifetree[]>([]);
  // Trees that joined this community via 'participant' links (invited, or self-joined).
  const [participatingTrees, setParticipatingTrees] = useState<Lifetree[]>([]);
  // Inviting a tree to stand with this community.
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteSearch, setInviteSearch] = useState('');
  const [inviteCandidates, setInviteCandidates] = useState<Lifetree[] | null>(null);
  const [inviteBusyId, setInviteBusyId] = useState<string | null>(null);
  const [sanctuaries, setSanctuaries] = useState<Sanctuary[]>([]);

  // Council — governance decisions
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [decTitle, setDecTitle] = useState('');
  const [decNature, setDecNature] = useState<DecisionNature>('intention');
  const [decBody, setDecBody] = useState('');
  const [decMode, setDecMode] = useState<DecisionMode>('threshold');
  const [proposing, setProposing] = useState(false);
  const [votingId, setVotingId] = useState<string | null>(null);
  const refreshDecisions = () => { getDecisions(community.id, communityLevels).then(setDecisions).catch(() => {}); };
  useEffect(() => { if (activeTab === 'council') refreshDecisions(); }, [activeTab, community.id]);

  const handlePropose = async () => {
    if (!currentUserId || !decTitle.trim()) return;
    setProposing(true);
    try {
      await createDecision(community, { nature: decNature, title: decTitle.trim(), body: decBody.trim(), proposedBy: currentUserId, mode: decMode });
      setDecTitle(''); setDecBody(''); setDecNature('intention');
      refreshDecisions();
    } catch (e: any) { showAlert(e?.message || 'Could not propose the decision.'); }
    setProposing(false);
  };

  const handleVote = async (id: string) => {
    if (!currentUserId) { showAlert('Sign in to add your voice.'); return; }
    setVotingId(id);
    try {
      const outcome = await voteOnDecision(id, currentUserId);
      if (outcome === 'listening') showAlert('This proposal is in listening — a concern was raised. It can continue once the concern is tended.');
      refreshDecisions();
    }
    catch (e: any) { showAlert(e?.message || 'Could not record your voice.'); }
    setVotingId(null);
  };

  const handleRaiseConcern = async (id: string) => {
    if (!currentUserId) { showAlert('Sign in to raise a concern.'); return; }
    if (!(await showConfirm('Raise a concern? This pauses the proposal and opens a reflective listening — it does not reject it.', { title: 'Raise a concern', confirmText: 'Raise concern' }))) return;
    setVotingId(id);
    try { await raiseConcern(id, currentUserId); refreshDecisions(); }
    catch (e: any) { showAlert(e?.message || 'Could not raise the concern.'); }
    setVotingId(null);
  };

  const handleResume = async (id: string) => {
    setVotingId(id);
    try { await resumeDecision(id); refreshDecisions(); }
    catch (e: any) { showAlert(e?.message || 'Could not resume.'); }
    setVotingId(null);
  };

  const handleWithdraw = async (id: string) => {
    if (!(await showConfirm('Withdraw this proposal?', { title: 'Withdraw', confirmText: 'Withdraw', danger: true }))) return;
    setVotingId(id);
    try { await withdrawDecision(id); refreshDecisions(); }
    catch (e: any) { showAlert(e?.message || 'Could not withdraw.'); }
    setVotingId(null);
  };

  // --- Quaker consensus handlers ---
  const handlePosition = async (id: string, stance: ConsensusStance) => {
    if (!currentUserId) { showAlert('Sign in to take a position.'); return; }
    let note: string | undefined;
    if (stance === 'block') {
      const reason = window.prompt('A block is a principled objection that halts unity. What is your concern?');
      if (reason === null) return; // cancelled
      note = reason.trim();
    }
    setVotingId(id);
    try {
      const outcome = await recordPosition(id, currentUserId, stance, note);
      if (outcome === 'closed') showAlert('This proposal is already settled.');
      refreshDecisions();
    } catch (e: any) { showAlert(e?.message || 'Could not record your position.'); }
    setVotingId(null);
  };

  const handleDiscern = async (id: string, outcome: 'passed' | 'rejected') => {
    const msg = outcome === 'passed'
      ? 'Discern that the meeting is in unity and adopt this proposal? A block would prevent this.'
      : 'Record that the meeting did not reach unity (not adopted)?';
    if (!(await showConfirm(msg, { title: outcome === 'passed' ? 'Sense of the meeting: unity' : 'Not in unity', confirmText: outcome === 'passed' ? 'Adopt' : 'Set aside', danger: outcome === 'rejected' }))) return;
    setVotingId(id);
    try { await discernDecision(id, outcome); refreshDecisions(); }
    catch (e: any) { showAlert(e?.message || 'Could not discern the sense of the meeting.'); }
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

  // The chain seal ("big red stamp") — mirrors community.chainLocked. Sealing is one-way for owners.
  const [chainSealed, setChainSealed] = useState(!!community.chainLocked);
  const [isSealing, setIsSealing] = useState(false);
  const [sealStatus, setSealStatus] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ sealed: number; intact: number; legacy: number; trees: number } | null>(null);

  // The tokenisation toggle — mirrors community.tokenisationEnabled (the AI-token economy).
  const [tokenisationOn, setTokenisationOn] = useState(!!community.tokenisationEnabled);
  const [isTogglingTokens, setIsTogglingTokens] = useState(false);


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
    setEditSocial(community.socialLinks || {});
    setEditTheme(normalizeTheme(community.theme));
    setLogoUrl(community.logoUrl || '');
    setHeroImageUrl(community.heroImageUrl || '');
    setImageUrls(community.imageUrls || []);
    setEditDefaultIntelligenceId(community.defaultIntelligenceId || '');
    setEditAvailableIntelligenceIds(community.availableIntelligenceIds || []);
    setChainSealed(!!community.chainLocked);
    setTokenisationOn(!!community.tokenisationEnabled);
  }, [community.id, community.name, community.vision, community.logoUrl, community.heroImageUrl, community.theme, (community.imageUrls || []).join(','), community.defaultIntelligenceId, (community.availableIntelligenceIds || []).join(','), community.chainLocked, community.tokenisationEnabled]);

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
    getCommunityEvents(community.id, communityLevels).then(setEvents).catch(() => {});
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

  const searchInviteCandidates = async () => {
    const term = inviteSearch.trim().toLowerCase();
    if (!term) { setInviteCandidates([]); return; }
    setInviteCandidates(null); // loading
    try {
      const all = await fetchAllLifetrees();
      const here = new Set(communityTrees.map(t => t.id));
      setInviteCandidates(all.filter(t => !t.isNature && !here.has(t.id) && (t.name || '').toLowerCase().includes(term)).slice(0, 8));
    } catch { setInviteCandidates([]); }
  };

  const handleInviteTree = async (tree: Lifetree) => {
    if (!currentUserId || inviteBusyId) return;
    setInviteBusyId(tree.id);
    try {
      await inviteTreeToCommunity({
        communityId: community.id, communityName: community.name || community.domain,
        lifetreeId: tree.id, lifetreeName: tree.name || 'A tree', treeOwnerId: tree.ownerId,
        invitedByUserId: currentUserId,
      });
      showAlert(`Invitation sent — ${tree.name}'s keeper will decide.`, 'Invite a tree');
      setInviteCandidates(prev => (prev || []).filter(t => t.id !== tree.id));
    } catch (e: any) {
      showAlert(e?.message || 'Could not send the invite.');
    }
    setInviteBusyId(null);
  };

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

  // The chain seal ("big red stamp", About → Vision). Sealing persists community.chainLocked so new
  // blocks are hashed with the canonical, reproducible scheme (src/domain/chain). When this is the
  // active node, App re-syncs the in-memory lock from the flag (onUpdate → hostCommunity → the effect
  // that calls setChainLocked). One-way for owners; only a super-admin can unseal (a testing escape).
  const handleToggleSeal = async (next: boolean) => {
    const confirmed = next
      ? await showConfirm(
          'Seal this chain? From now on, every new block this node mints is sealed with the canonical, reproducible hash — so anyone can verify the chain end to end. Blocks minted before now keep their original hashes. This is a commitment.',
          { title: 'Seal the chain', confirmText: 'Seal it' },
        )
      : await showConfirm(
          'Unseal this chain? New blocks return to the legacy hash and can no longer be verified end to end. Blocks already sealed stay sealed.',
          { title: 'Unseal the chain', confirmText: 'Unseal', danger: true },
        );
    if (!confirmed) return;
    setIsSealing(true);
    setSealStatus(null);
    try {
      await updateCommunity(community.id, { chainLocked: next });
      setChainSealed(next);
      onUpdate?.({ chainLocked: next });
      setSealStatus(next ? 'Chain sealed.' : 'Chain unsealed.');
      setTimeout(() => setSealStatus(null), 3000);
    } catch (e) {
      console.error(e);
      setSealStatus('Could not update the seal. Please try again.');
    }
    setIsSealing(false);
  };

  const handleToggleTokenisation = async (next: boolean) => {
    setIsTogglingTokens(true);
    setTokenisationOn(next); // optimistic
    try {
      await updateCommunity(community.id, { tokenisationEnabled: next });
      setTokenisationEnabled(next); // sync the in-memory flag so the UI reacts immediately
      onUpdate?.({ tokenisationEnabled: next });
    } catch (e) {
      console.error(e);
      setTokenisationOn(!next); // revert on failure
    }
    setIsTogglingTokens(false);
  };

  // Verify the node's sealed blocks: recompute each canonically-sealed block's hash and confirm it
  // still matches. Per-block (tamper-evident) rather than chain-walking, so off-chain tends don't
  // cause false failures; legacy blocks predate the scheme and are counted separately, not failed.
  const handleVerify = async () => {
    setIsVerifying(true);
    setVerifyResult(null);
    try {
      const trees = linkedTrees.length ? linkedTrees : await getTreesByDomain(community.domain, currentUserId);
      let sealed = 0, intact = 0, legacy = 0;
      for (const tree of trees) {
        let pulses: ChainBlock[] = [];
        try { pulses = await getPulsesByTreeId(tree.id) as unknown as ChainBlock[]; } catch { continue; } // skip trees this viewer can't read
        for (const p of pulses) {
          if (isCanonicallySealed(p)) { sealed++; if (await verifyBlockSeal(p)) intact++; }
          else legacy++;
        }
      }
      setVerifyResult({ sealed, intact, legacy, trees: trees.length });
    } catch (e) {
      console.error(e);
      setSealStatus('Could not verify right now.');
    }
    setIsVerifying(false);
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
      getCommunityEvents(community.id, communityLevels).then(setEvents).catch(() => {});
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
              <div>
                <SectionTitle title="Vision" sub="What this community is growing towards." />
                {canEdit ? (
                  <>
                    <RichTextEditor value={editVision} onChange={setEditVision} placeholder="Share your community's vision..." />
                    <SaveBar />
                  </>
                ) : (
                  <div className="prose prose-slate max-w-none text-slate-700 leading-relaxed break-words [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg" dangerouslySetInnerHTML={{ __html: community.vision ? sanitizeRichText(community.vision) : '<p>No vision shared yet.</p>' }} />
                )}

                {/* The chain seal — this node's commitment to a verifiable chain. Sealed is a public
                    mark of integrity (shown to all); sealing is the owner's one-way "big red stamp". */}
                {(chainSealed || canEdit) && (
                  <div className="mt-8 border-t border-slate-100 pt-6">
                    {chainSealed ? (
                      <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
                        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-emerald-300"><Icons.ShieldCheck /></span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-emerald-900">Chain sealed</p>
                          <p className="mt-0.5 text-sm text-emerald-800/80">Every new block this node mints is sealed with the canonical, reproducible hash — so its content can be verified against its hash.</p>
                          {firstTree?.latestHash && (
                            <p className="mt-1 break-all font-mono text-xs text-emerald-700/60">head {firstTree.latestHash.slice(0, 16)}…</p>
                          )}
                          {canEdit && (
                            <div className="mt-3">
                              <button onClick={handleVerify} disabled={isVerifying} className="inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-white px-4 py-2 text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50">
                                <Icons.ShieldCheck /> {isVerifying ? 'Verifying…' : 'Verify sealed blocks'}
                              </button>
                              {verifyResult && (
                                <p className="mt-2 text-xs">
                                  {verifyResult.sealed === 0 ? (
                                    <span className="text-emerald-800/70">No sealed blocks yet — the next pulse this node mints will be the first.{verifyResult.legacy > 0 ? ` ${verifyResult.legacy} earlier block${verifyResult.legacy === 1 ? '' : 's'} predate the seal.` : ''}</span>
                                  ) : verifyResult.intact === verifyResult.sealed ? (
                                    <span className="font-semibold text-emerald-700">✓ {verifyResult.sealed} sealed block{verifyResult.sealed === 1 ? '' : 's'} intact across {verifyResult.trees} tree{verifyResult.trees === 1 ? '' : 's'}.{verifyResult.legacy > 0 ? ` (${verifyResult.legacy} legacy, pre-seal.)` : ''}</span>
                                  ) : (
                                    <span className="font-bold text-red-600">⚠ {verifyResult.sealed - verifyResult.intact} of {verifyResult.sealed} sealed block{verifyResult.sealed === 1 ? '' : 's'} failed verification.</span>
                                  )}
                                </p>
                              )}
                            </div>
                          )}
                          <div className="mt-2 flex items-center gap-3">
                            {isSuperAdmin && (
                              <button onClick={() => handleToggleSeal(false)} disabled={isSealing} className="text-xs font-semibold text-emerald-700/70 underline underline-offset-2 hover:text-red-600 disabled:opacity-50">
                                {isSealing ? 'Working…' : 'Unseal (admin)'}
                              </button>
                            )}
                            {sealStatus && <span className="text-xs text-slate-500">{sealStatus}</span>}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-500"><Icons.Stamp /></span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-slate-800">Seal the chain</p>
                          <p className="mt-0.5 text-sm text-slate-500">Commit this node to a verifiable chain: from now on every new block carries the canonical, reproducible hash, so anyone can check it. Blocks minted before now keep their original hashes. A one-way step.</p>
                          <div className="mt-3 flex items-center gap-3">
                            <button onClick={() => handleToggleSeal(true)} disabled={isSealing} className="inline-flex items-center gap-2 rounded-full bg-red-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-red-600/20 transition-all hover:bg-red-700 active:scale-95 disabled:opacity-50">
                              <Icons.Stamp /> {isSealing ? 'Sealing…' : 'Seal this chain'}
                            </button>
                            {sealStatus && <span className="text-sm text-slate-500">{sealStatus}</span>}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Tokenisation toggle — turn the AI-token ("Attention-Energy") economy on/off for
                    this node, the same way the chain seal is flipped. Owner/admin only. */}
                {canEdit && (
                  <div className="mt-8 border-t border-slate-100 pt-6">
                    <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                      <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600"><Icons.SparkleFill /></span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-800">AI-token economy</p>
                        <p className="mt-0.5 text-sm text-slate-500">Turn on “Attention-Energy” tokens for this node — trees earn tokens and spend them on deep AI. While off, AI stays free and the token balance/cost UI is hidden.</p>
                      </div>
                      <button
                        onClick={() => handleToggleTokenisation(!tokenisationOn)}
                        disabled={isTogglingTokens}
                        role="switch"
                        aria-checked={tokenisationOn}
                        title={tokenisationOn ? 'Tokenisation on' : 'Tokenisation off'}
                        className={`relative mt-1 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${tokenisationOn ? 'bg-emerald-600' : 'bg-slate-300'}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${tokenisationOn ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </div>
                  </div>
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
                        <div className="h-full w-full" style={{ backgroundColor: community.theme?.primary || tabTone('communities') }} />
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
                        <div className="h-full w-full" style={{ backgroundColor: community.theme?.primary || tabTone('communities') }} />
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
                <div className="mb-4 flex items-start justify-between gap-3">
                  <SectionTitle title="Community Trees" sub="Lifetrees rooted here or standing with this community. Join a guardianship to help tend one." />
                  {currentUserId && (
                    <button onClick={() => { setInviteOpen(o => !o); setInviteCandidates(null); setInviteSearch(''); }} className="shrink-0 rounded-full bg-teal-600 px-4 py-2 text-xs font-bold text-white shadow-md transition-all hover:bg-teal-700 active:scale-95">
                      <span className="flex items-center gap-1.5"><Icons.Plus /> Invite a tree</span>
                    </button>
                  )}
                </div>
                {inviteOpen && (
                  <div className="mb-4 rounded-lg border border-teal-100 bg-teal-50/50 p-4">
                    <div className="flex gap-2">
                      <input dir="auto" value={inviteSearch} onChange={e => setInviteSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') searchInviteCandidates(); }}
                        placeholder="Search trees by name…"
                        className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-800 outline-none focus:border-teal-300" />
                      <button onClick={searchInviteCandidates} className="shrink-0 rounded-full bg-teal-600 px-4 py-2 text-xs font-bold text-white hover:bg-teal-700">Search</button>
                    </div>
                    {inviteCandidates !== null && (
                      <div className="mt-3 space-y-2">
                        {inviteCandidates.length === 0 ? (
                          <p className="text-xs text-slate-400">No matching trees (already-standing and nature trees are hidden).</p>
                        ) : inviteCandidates.map(tr => (
                          <div key={tr.id} className="flex items-center gap-3 rounded-lg border border-slate-100 bg-white p-2.5">
                            <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                              {tr.latestGrowthUrl || tr.imageUrl ? <img src={tr.latestGrowthUrl || tr.imageUrl} className="h-full w-full object-cover" alt="" /> : <div className="h-full w-full" style={{ backgroundColor: community.theme?.primary || tabTone('communities') }} />}
                            </div>
                            <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-800">{tr.name}</span>
                            <button onClick={() => handleInviteTree(tr)} disabled={inviteBusyId === tr.id} className="shrink-0 rounded-full border border-teal-200 bg-white px-3 py-1.5 text-xs font-bold text-teal-700 hover:bg-teal-50 disabled:opacity-50">
                              {inviteBusyId === tr.id ? '…' : 'Invite'}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {communityTrees.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center text-slate-400">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-500"><Icons.Tree /></div>
                    <p className="text-sm">No lifetrees linked to this domain yet.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {communityTrees.map(tree => (
                      <div
                        key={tree.id}
                        className={`flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3 shadow-sm ${onViewTree ? 'cursor-pointer transition-shadow hover:shadow-md' : ''}`}
                        onClick={() => onViewTree?.(tree)}
                      >
                        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                          {tree.latestGrowthUrl || tree.imageUrl ? <img src={tree.latestGrowthUrl || tree.imageUrl} className="h-full w-full object-cover" alt={tree.name} /> : <div className="h-full w-full" style={{ backgroundColor: community.theme?.primary || tabTone('communities') }} />}
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

            {activeTab === 'model' && (
              <div>
                <SectionTitle title="Growth" sub="How this node is crystallising — its trees weighted by their chain growth, links and pulses." />
                <NodeGrowthTree community={community} trees={domainTrees} onViewTree={onViewTree} />
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
                          {ev.imageUrl ? <img src={ev.imageUrl} className="h-full w-full object-cover" alt={ev.title} /> : <div className="h-full w-full" style={{ backgroundColor: community.theme?.primary || tabTone('communities') }} />}
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
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold uppercase text-slate-400">How the circle decides</span>
                      <div className="flex rounded-full border border-slate-200 bg-white p-0.5 text-xs font-bold w-full sm:max-w-md">
                        <button type="button" onClick={() => setDecMode('threshold')} className={`flex-1 rounded-full px-3 py-1.5 transition-colors ${decMode === 'threshold' ? 'bg-emerald-600 text-white shadow' : 'text-slate-500 hover:text-slate-700'}`}>Voices ({votesRequired(decNature)})</button>
                        <button type="button" onClick={() => setDecMode('consensus')} className={`flex-1 rounded-full px-3 py-1.5 transition-colors ${decMode === 'consensus' ? 'bg-emerald-600 text-white shadow' : 'text-slate-500 hover:text-slate-700'}`}>Consensus (Quaker)</button>
                      </div>
                      <p className="text-[11px] text-slate-500">{decMode === 'consensus' ? 'No counting — the meeting seeks unity. Each voice may unite, stand aside, or block; the clerk discerns the sense of the meeting.' : `Passes when ${votesRequired(decNature)} voice(s) unite. A concern opens a reflective pause.`}</p>
                    </div>
                    <button onClick={handlePropose} disabled={proposing || !decTitle.trim()} className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">{proposing ? '…' : t('propose')}</button>
                  </div>
                )}

                {decisions.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-400">{t('no_decisions')}</p>
                ) : (
                  <div className="space-y-3">
                    {councilView(decisions, currentUserId).map(d => {
                      const consensus = d.mode === 'consensus';
                      const open = !d.passed && !d.closed;
                      const clerk = d.isProposer || !!canEdit;
                      return (
                        <div key={d.id} className={`rounded-2xl border p-4 ${d.passed ? 'border-emerald-200 bg-emerald-50/40' : (consensus && d.blocked) ? 'border-rose-200 bg-rose-50/40' : d.listening ? 'border-indigo-200 bg-indigo-50/40' : d.closed ? 'border-slate-200 bg-slate-50' : 'border-slate-200 bg-white'}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="text-sm font-bold text-slate-800">{d.title}</h4>
                                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-500">{t(('nature_' + d.nature) as any)}</span>
                                {consensus && <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold uppercase text-sky-700">Consensus</span>}
                                {d.passed
                                  ? <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">{t('passed')}</span>
                                  : d.closed
                                    ? <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">{decisionStatusLabels[d.status] || 'Closed'}</span>
                                    : consensus
                                      ? (d.blocked
                                          ? <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold uppercase text-rose-700">Blocked</span>
                                          : <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700">In discernment</span>)
                                      : d.listening
                                        ? <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold uppercase text-indigo-700">Listening</span>
                                        : <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700">{t('decision_open')}</span>}
                              </div>
                              {d.body && <p className="mt-1 text-xs italic text-slate-500">{d.body}</p>}

                              {consensus ? (
                                <>
                                  <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-bold">
                                    <span className="text-emerald-600">{d.unites} unite</span>
                                    <span className="text-slate-300">·</span>
                                    <span className="text-slate-500">{d.standAsides} stand aside</span>
                                    <span className="text-slate-300">·</span>
                                    <span className={d.blocks ? 'text-rose-600' : 'text-slate-400'}>{d.blocks} block</span>
                                    {d.myStance && <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-500">you: {consensusStanceLabels[d.myStance].toLowerCase()}</span>}
                                  </div>
                                  {d.blocked && (
                                    <div className="mt-2 rounded-xl border border-rose-100 bg-rose-50 p-2.5 text-[11px] text-rose-800">
                                      <p className="font-semibold">A block stands — the meeting is not in unity. Tend it before adopting.</p>
                                      {d.positions.filter(p => p.stance === 'block' && p.note).slice(-3).map((p, i) => <p key={i} className="mt-1 italic">“{p.note}”</p>)}
                                    </div>
                                  )}
                                </>
                              ) : (
                                <>
                                  <div className="mt-2 text-[11px] font-bold text-slate-400">{d.voiceCount} / {d.voicesRequired} {t('voices')}</div>
                                  {d.listening && (
                                    <div className="mt-2 rounded-xl border border-indigo-100 bg-indigo-50 p-2.5 text-[11px] text-indigo-800">
                                      <p className="font-semibold">A concern was raised. This proposal has entered listening.</p>
                                      {d.concerns.filter(c => c.note).slice(-3).map((c, i) => <p key={i} className="mt-1 italic">“{c.note}”</p>)}
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-1.5">
                              {consensus ? (
                                <>
                                  {open && currentUserId && (
                                    <div className="flex flex-wrap justify-end gap-1.5">
                                      <button onClick={() => handlePosition(d.id, 'unite')} disabled={votingId === d.id} className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-50 ${d.myStance === 'unite' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}>Unite</button>
                                      <button onClick={() => handlePosition(d.id, 'stand_aside')} disabled={votingId === d.id} className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-50 ${d.myStance === 'stand_aside' ? 'bg-slate-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Stand aside</button>
                                      <button onClick={() => handlePosition(d.id, 'block')} disabled={votingId === d.id} className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-50 ${d.myStance === 'block' ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-600 hover:bg-rose-100'}`}>Block</button>
                                    </div>
                                  )}
                                  {open && clerk && (
                                    <div className="mt-0.5 flex items-center gap-2">
                                      <button onClick={() => handleDiscern(d.id, 'passed')} disabled={votingId === d.id || d.blocked} title={d.blocked ? 'A block must be tended before the meeting can find unity' : 'Discern the sense of the meeting and adopt'} className="rounded-full bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50">Adopt (unity)</button>
                                      <button onClick={() => handleDiscern(d.id, 'rejected')} disabled={votingId === d.id} className="rounded-full px-3 py-1 text-[11px] font-medium text-slate-400 transition-colors hover:text-red-500 disabled:opacity-50">Not adopted</button>
                                    </div>
                                  )}
                                </>
                              ) : (
                                <>
                                  {open && !d.listening && (
                                    <button onClick={() => handleVote(d.id)} disabled={votingId === d.id || d.voted} className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors disabled:opacity-50 ${d.voted ? 'bg-slate-100 text-slate-400' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}>
                                      {d.voted ? t('voted') : (votingId === d.id ? '…' : t('vote'))}
                                    </button>
                                  )}
                                  {open && !d.listening && currentUserId && (
                                    <button onClick={() => handleRaiseConcern(d.id)} disabled={votingId === d.id} className="rounded-full px-3 py-1 text-[11px] font-bold text-indigo-600 hover:bg-indigo-50 disabled:opacity-50">Raise a concern</button>
                                  )}
                                  {d.listening && clerk && (
                                    <button onClick={() => handleResume(d.id)} disabled={votingId === d.id} className="rounded-full bg-indigo-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-indigo-700 disabled:opacity-50">Tend &amp; resume</button>
                                  )}
                                </>
                              )}
                              {open && clerk && (
                                <button onClick={() => handleWithdraw(d.id)} disabled={votingId === d.id} className="rounded-full px-3 py-1 text-[11px] font-medium text-slate-400 transition-colors hover:text-red-500">Withdraw</button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
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
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-500"><Icons.Wizard /></div>
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
                  defaultTheme={nodeDefaultTheme(community.domain)}
                  logoUrl={logoUrl}
                  onLogoUpload={handleLogoUpload}
                  uploadingLogo={isUploadingLogo}
                  heroUrl={heroImageUrl}
                  onHeroUpload={handleHeroUpload}
                  uploadingHero={isUploadingHero}
                  onRemoveHero={() => {
                    // Persist immediately (like upload does) — otherwise the old photo returns
                    // unless the user also remembers to hit Save.
                    setHeroImageUrl('');
                    updateCommunity(community.id, { heroImageUrl: '' }).catch(() => {});
                    onUpdate?.({ heroImageUrl: '' });
                  }}
                  heroHint={t('hero_hint_community')}
                  name={editName}
                  onNameChange={setEditName}
                  imageUrls={imageUrls}
                  onAddImage={handleAddImage}
                  onRemoveImage={handleRemoveImage}
                  uploadingImage={isUploadingImage}
                />

                {/* Community links — shown in the site footer. */}
                <div className="mt-8 border-t border-slate-100 pt-6">
                  <h4 className="mb-1 text-sm font-bold uppercase tracking-wider text-slate-400">Community links</h4>
                  <p className="mb-3 text-xs text-slate-500">Shown in the site footer. Paste a full URL or a handle/number.</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-600"><Icons.Instagram size={14} /> Instagram</span>
                      <input value={editSocial.instagram || ''} onChange={e => setEditSocial(s => ({ ...s, instagram: e.target.value }))} placeholder="@handle or URL" className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    </label>
                    <label className="block">
                      <span className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-600"><Icons.Telegram size={14} /> Telegram</span>
                      <input value={editSocial.telegram || ''} onChange={e => setEditSocial(s => ({ ...s, telegram: e.target.value }))} placeholder="t.me/group or @handle" className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    </label>
                    <label className="block">
                      <span className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-600"><Icons.WhatsApp size={14} /> WhatsApp</span>
                      <input value={editSocial.whatsapp || ''} onChange={e => setEditSocial(s => ({ ...s, whatsapp: e.target.value }))} placeholder="wa.me invite link or number" className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    </label>
                    <label className="block">
                      <span className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-600"><Icons.Globe /> Website</span>
                      <input value={editSocial.website || ''} onChange={e => setEditSocial(s => ({ ...s, website: e.target.value }))} placeholder="example.com" className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    </label>
                  </div>
                </div>

                {/* Home carousel quotes — reflections shown to signed-out visitors. */}
                <div className="mt-8 border-t border-slate-100 pt-6">
                  <h4 className="mb-1 text-sm font-bold uppercase tracking-wider text-slate-400">Home carousel quotes</h4>
                  <p className="mb-3 text-xs text-slate-500">Reflections shown in the signed-out home carousel. Leave empty to use the lightseed defaults.</p>
                  <div className="space-y-2">
                    {editCarouselQuotes.map((q, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <textarea value={q} onChange={e => setEditCarouselQuotes(prev => prev.map((x, j) => j === i ? e.target.value : x))} rows={2} placeholder="A reflection…" className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                        <button type="button" onClick={() => setEditCarouselQuotes(prev => prev.filter((_, j) => j !== i))} className="mt-1 shrink-0 rounded-full p-1.5 text-red-500 transition-colors hover:bg-red-50" title="Remove"><Icons.Close /></button>
                      </div>
                    ))}
                    <button type="button" onClick={() => setEditCarouselQuotes(prev => [...prev, ''])} className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50"><Icons.Plus /> Add quote</button>
                  </div>
                </div>
              </div>
            )}
      </ProfileLayout>
    </div>
  );
};
