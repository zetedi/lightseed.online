
import React, { useState, useMemo } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useSession } from '../../contexts/SessionContext';
import { Icons } from '../ui/Icons';
import { OutwardLink } from '../ui/OutwardLink';
import { MahameruAvatar } from '../ui/MahameruAvatar';
import { Community, CommunityInvite, Lifetree, Pulse } from '../../types';
import { isTreeCircle } from '../../domain/treeCircle';
import { isDomainVerified } from '../../domain/domainVerification';
import { CommunityVision } from './CommunityVision';
import { CommunityCouncil } from './CommunityCouncil';
import { CommunityEvents } from './CommunityEvents';
import { CommunityFirstTree } from './CommunityFirstTree';
import { CommunityLightHouse } from './CommunityLightHouse';
import { CommunityTreesTab } from './CommunityTreesTab';
import { CommunityMembers } from './CommunityMembers';
import { PathOverview } from '../pathway/PathOverview';
import { CommunityIntelligence } from './CommunityIntelligence';
import { CommunityLight } from './CommunityLight';
import { CommunityDigitalTree } from './CommunityDigitalTree';
import { LoveButton } from '../ui/LoveButton';
import { CommunityCodeChain } from './CommunityCodeChain';
import { CommunityAppearance } from './CommunityAppearance';
import { CommunityInterbeingMatrix } from './CommunityInterbeingMatrix';
import { BeingProfile, type BeingSection } from '../sections/BeingProfile';
import { SectionTitle } from '../ui/SectionTitle';
import { SuperDot } from '../ui/SuperDot';
import { type LightHouse as LightHouseType } from '../../domain/lightHouse';
import { LoreSection, loreTabs, type LoreTabId } from '../about/AboutSections';
import { NodeGrowthTree } from '../about/NodeGrowthTree';
import { queryableLevels } from '../../domain/pulseVisibility';

import { Picture } from '../ui/Picture';
import { FullViewButton } from '../ui/FullView';
import { nodeDomains } from '../../config/charter';
import { useCommunityDoor } from '../../hooks/useCommunityDoor';
import { useCommunityEditing } from '../../hooks/useCommunityEditing';
import { useCommunityGarden } from '../../hooks/useCommunityGarden';
import { useCommunityLightHouses } from '../../hooks/useCommunityLightHouses';
import { useCircleForming } from '../../hooks/useCircleForming';
import { NewsletterAdmin } from './NewsletterAdmin';
interface CommunityProfileProps {
  community: Community;
  // An invitation the viewer arrived holding (/i/<id>) — the door greets them by it.
  arrivedInvite?: CommunityInvite | null;
  // Open the auth modal — the signed-out invitee's door out of the greeting.
  onSignIn?: () => void;
  onUpdate?: (updates: Partial<Community>) => void;
  // This community is the place the viewer stands in (the host of the domain, or the one
  // being viewed as): its Events tab shows the domain's happenings too.
  isHost?: boolean;
  onClose: () => void;
  onViewTree?: (tree: Lifetree) => void;
  onViewLightHouse?: (s: LightHouseType) => void;
  // Open an event's page. Seeing an event implies at least viewer rights, so this is
  // offered to everyone — not gated behind edit permissions.
  onViewEvent?: (event: Pulse) => void;
  // Superadmin only — "switch to community view": render the whole app as this community.
  onEnterCommunityView?: (community: Community) => void;
}

const bareDomain = (d?: string) => (d || '').toLowerCase().replace(/^www\./, '');

export const CommunityProfile: React.FC<CommunityProfileProps> = ({
  community,
  arrivedInvite,
  onSignIn,
  onUpdate,
  isHost = false,
  onClose,
  onViewTree,
  onViewEvent,
  onEnterCommunityView,
  onViewLightHouse,
}) => {
  const { t } = useLanguage();
  // Session-derived values from context (were prop-drilled from App).
  const { lightseed, isAdmin, isSuperAdmin, publicName } = useSession();
  const currentUser = lightseed;
  const currentUserId = lightseed?.uid;
  // The viewer's standing at this community's door (hooks/useCommunityDoor): member, steward,
  // keeper by link, the knocks already made, and the four hands that open the door.
  const {
    isKeeperByLink, isMember, isSteward, joinRequested, keepRequested, joining, keepAsking,
    door, inviteForHere, inviterName,
    handleJoin, handleAskToKeep, handleStepIn, handleEnterWithInvite,
  } = useCommunityDoor(community, currentUserId, arrivedInvite);
  const canEdit = currentUserId === community.anchorUid || isKeeperByLink || isSuperAdmin || isAdmin;
  const canDelete = currentUserId === community.anchorUid || isKeeperByLink || isSuperAdmin;

  // The active profile section — controlled so a section (e.g. Light) can steer to another
  // (the Council). Undefined until the first change: BeingProfile keeps its own default first.
  const [section, setSection] = useState<string | undefined>(undefined);
  // The visibility levels this viewer may query at community scope — shared by the events and
  // council (decisions) tabs, so a signed-out viewer only ever requests public docs. Memoized so
  // the tab components can safely depend on it without refetching every render.
  const communityLevels = useMemo(() => queryableLevels(
    { uid: currentUserId, isStaff: isSuperAdmin || isAdmin, communityIds: isMember ? [community.id] : [] },
    { communityId: community.id },
  ), [currentUserId, isSuperAdmin, isAdmin, isMember, community.id]);

  // The face draws; four hooks hold its hands (hooks/useCommunity*, useCircleForming).
  const {
    editName, setEditName, editVision, setEditVision, editPapers, setEditPapers,
    editSocial, setEditSocial, editFeaturedVideo, setEditFeaturedVideo, editCarouselQuotes, setEditCarouselQuotes,
    editCustomLanding, setEditCustomLanding, editShowStats, setEditShowStats,
    editLandingPages, setEditLandingPages, editTheme, setEditTheme,
    editPaletteReach, setEditPaletteReach, editMail, setEditMail,
    logoUrl, heroImageUrl, imageUrls,
    isSaving, isDeleting, isUploadingLogo, isUploadingHero, isUploadingImage, status,
    appearanceSave,
    handleSave, handleDelete, handleLogoUpload, handleHeroUpload, handleAddImage, handleImagesChange, handleRemoveHero,
  } = useCommunityEditing(community, onUpdate, onClose);
  const { linkedTrees, domainTrees, firstTree, communityTrees, guardedTreeIds, togglingId, handleToggleGuardian } = useCommunityGarden(community, currentUserId);
  const lightHouseHands = useCommunityLightHouses(community, { currentUserId, isSuperAdmin, isAdmin, isMember, canEdit });
  const { mayFormCommunity, formName, setFormName, forming, handleFormCommunity } = useCircleForming(community, currentUserId, canEdit, onUpdate);

  // Icons for the shared network-lore tabs (Path, Yantra).
  const loreIcons: Record<LoreTabId, React.ReactNode> = {
    genesis: <Icons.Hash />,
    whitepaper: <Icons.Tree />,
    yantra: <Icons.Venn />,
    protection: <Icons.ShieldCheck />,
  };

  // The Yantra, code lineage and seed lore belong to the two historical seed communities.
  // This is content identity only — not a claim about Hub role, custody or data scope.
  const isSeedLoreCommunity = nodeDomains.includes(bareDomain(community.domain));

  // The community's sections — each `render` closes over this shell's state and handlers.
  const sections: BeingSection[] = [
    {
      key: 'vision', label: t('vision'), icon: <Icons.Eye />, render: () => (
        <CommunityVision
          community={community}
          canEdit={canEdit}
          isSuperAdmin={isSuperAdmin}
          currentUserId={currentUserId}
          firstTree={firstTree}
          linkedTrees={linkedTrees}
          editVision={editVision}
          onVisionChange={setEditVision}
          editPapers={editPapers}
          onPapersChange={setEditPapers}
          onSave={handleSave}
          isSaving={isSaving}
          saveDisabled={isSaving || isUploadingLogo || isUploadingImage}
          status={status}
          onUpdate={onUpdate}
        />
      ),
    },
    {
      key: 'digital', label: t('digital_tree'), icon: <Icons.Tree />, render: () => (
        <CommunityDigitalTree community={community} onViewPulse={onViewEvent} />
      ),
    },
    {
      key: 'firsttree', label: t('community_first_tree'), icon: <Icons.Tree />, render: () => (
        <CommunityFirstTree
          community={community}
          firstTree={firstTree}
          onViewTree={onViewTree}
          guardedTreeIds={guardedTreeIds}
          togglingId={togglingId}
          onToggleGuardian={handleToggleGuardian}
        />
      ),
    },
    {
      key: 'lightHouse', label: t('light_houses'), icon: <Icons.Sun />, render: () => (
        <CommunityLightHouse
          community={community}
          lightHouses={lightHouseHands.viewableLightHouses}
          canEdit={canEdit}
          onCreate={lightHouseHands.consecrate}
          onUploadImage={lightHouseHands.uploadLightHouseImage}
          onOpen={onViewLightHouse}
          adoptable={lightHouseHands.adoptable}
          onAdopt={lightHouseHands.adopt}
        />
      ),
    },
    {
      key: 'trees', label: t('community_trees'), icon: <Icons.Tree />, render: () => (
        <CommunityTreesTab
          community={community}
          currentUserId={currentUserId}
          communityTrees={communityTrees}
          onViewTree={onViewTree}
          guardedTreeIds={guardedTreeIds}
          togglingId={togglingId}
          onToggleGuardian={handleToggleGuardian}
        />
      ),
    },
    {
      key: 'model', label: t('growth'), icon: <MahameruAvatar size={20} />, render: () => (
        <div>
          <SectionTitle title={t('growth')} sub={t('node_growth_sub')} />
          <NodeGrowthTree community={community} trees={domainTrees} onViewTree={onViewTree} />
        </div>
      ),
    },
    {
      key: 'events', label: t('events'), icon: <Icons.Loc />, render: () => (
        <CommunityEvents
          community={community}
          canEdit={canEdit}
          currentUserId={currentUserId}
          currentUserName={publicName}
          currentUserPhoto={currentUser?.photoURL}
          communityLevels={communityLevels}
          isHost={isHost}
          onViewEvent={onViewEvent}
        />
      ),
    },
    {
      key: 'council', label: t('council'), icon: <Icons.Venn />, render: () => (
        <CommunityCouncil community={community} canEdit={canEdit} currentUserId={currentUserId} communityLevels={communityLevels} />
      ),
    },
    {
      // THE WALLET (ring 2026-09-19): where the community's coin is kept — the tab says wallet,
      // the page inside says the coin's name (domain/coin).
      key: 'light', label: t('wallet'), icon: <Icons.Wallet />, render: () => (
        <CommunityLight communityId={community.id} community={community} isKeeper={canEdit} onGoToCouncil={() => setSection('council')} onUpdate={onUpdate} />
      ),
    },
    {
      key: 'members', label: t('members'), icon: <Icons.Users />, render: () => (
        <CommunityMembers community={community} currentUserId={currentUserId} canManage={canEdit || isSteward} isAnchor={canEdit} onCommunityUpdate={onUpdate} />
      ),
    },
    {
      key: 'interbeing', label: t('interbeing'), icon: <Icons.Link />, render: () => (
        <CommunityInterbeingMatrix community={community} canManage={canEdit} />
      ),
    },
    {
      key: 'path', label: t('the_path'), icon: <Icons.ArrowRight />, render: () => (
        <div>
          <SectionTitle title={t('the_path')} sub={t('the_path_sub')} />
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6 dark:bg-slate-900 dark:border-slate-800">
            <PathOverview />
          </div>
        </div>
      ),
    },
    // The network's founding lore (Genesis, the Path, the Yantra, Protection) stays with the
    // central lightseed / lifeseed nodes — every community will have its own genesis and path.
    ...loreTabs.filter(() => isSeedLoreCommunity).map((tab): BeingSection => ({
      key: tab.id, label: tab.label, icon: loreIcons[tab.id], render: () => <LoreSection id={tab.id} />,
    })),
    // The seed communities' own body — the repo's git history drawn as a growth chain, like the lore.
    ...(isSeedLoreCommunity ? [{ key: 'codechain', label: t('code_chain'), icon: <Icons.Hash />, render: () => <CommunityCodeChain /> } satisfies BeingSection] : []),
    ...(canEdit ? [
      {
        key: 'intelligence', label: t('intelligence'), icon: <Icons.Intelligence />, render: () => (
          <CommunityIntelligence community={community} canEdit={canEdit} currentUserId={currentUserId} onUpdate={onUpdate} />
        ),
      },
      {
        // The letter of this place — its keepers write it here, to those who subscribed at the place.
        key: 'letter', label: t('newsletter'), icon: <Icons.Send />, render: () => (
          <NewsletterAdmin community={community} embedded onBack={() => setSection('vision')} />
        ),
      },
      {
        key: 'appearance', label: t('appearance'), icon: <Icons.Image />, render: () => (
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
            onImagesChange={handleImagesChange}
            uploadingImage={isUploadingImage}
            editSocial={editSocial}
            onSocialChange={setEditSocial}
            editFeaturedVideo={editFeaturedVideo}
            onFeaturedVideoChange={setEditFeaturedVideo}
            editCarouselQuotes={editCarouselQuotes}
            onCarouselQuotesChange={setEditCarouselQuotes}
            editCustomLanding={editCustomLanding}
            onCustomLandingChange={setEditCustomLanding}
            editShowStats={editShowStats}
            onShowStatsChange={setEditShowStats}
            editLandingPages={editLandingPages}
            onLandingPagesChange={setEditLandingPages}
            editPaletteReach={editPaletteReach}
            onPaletteReachChange={setEditPaletteReach}
            editMail={editMail}
            onMailChange={setEditMail}
            autosave={appearanceSave.state}
            status={status}
          />
        ),
      },
    ] : []),
  ];

  return (
    <BeingProfile
      onClose={onClose}
      sections={sections}
      activeSection={section}
      onSectionChange={setSection}
      banner={mayFormCommunity ? (
        <div className="mb-4 rounded-2xl border border-violet-200 bg-violet-50/70 p-4 dark:border-violet-900 dark:bg-violet-950/70">
          <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{t('circle_form_title')}</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">{t('circle_form_desc')}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              value={formName}
              onChange={e => setFormName(e.target.value)}
              placeholder={t('circle_form_name_ph')}
              className="w-56 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-violet-400 dark:bg-slate-900 dark:border-slate-700"
            />
            <button onClick={handleFormCommunity} disabled={forming || !formName.trim()}
              className="rounded-full bg-violet-600 px-4 py-1.5 text-xs font-bold text-white transition-colors hover:bg-violet-500 disabled:opacity-50">
              {forming ? '…' : t('circle_form_button')}
            </button>
          </div>
        </div>
      ) : undefined}
      hero={{
        // Only the chosen hero — no gallery fallback, so removing the hero actually removes it.
        // The hero wears the USER profile's exact clothes (Zoltán, 2026-07-22): same default
        // padding/background, same compact row, same avatar size; the chips read the tree
        // count first, then the birth date.
        imageUrl: heroImageUrl,
        avatarRowClassName: 'flex flex-row items-center gap-3 sm:gap-5',
        titleRowClassName: 'flex flex-wrap items-center gap-x-3 gap-y-1.5 justify-start',
        actions: (
          <>
            {/* The DOOR — open: step in; invite: knock (or enter holding an invitation);
                closed: rest. Keepers accept knocks on the Members tab. Members see standing.
                Mobile keeps every action compact (icons, tight padding) so nothing overflows. */}
            {!currentUserId && inviteForHere && (
              <button onClick={() => onSignIn?.()} className="flex items-center gap-1 rounded-full border border-amber-300/50 bg-amber-400/15 px-2.5 py-1.5 text-[11px] font-bold text-amber-200 transition-colors hover:bg-amber-400 hover:text-white sm:px-4 sm:py-2 sm:text-xs">
                🎟 {t('signin_use_invitation')}
              </button>
            )}
            {currentUserId && !isMember && inviteForHere && (
              <button onClick={handleEnterWithInvite} disabled={joining} className="flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-amber-400 disabled:opacity-50 sm:px-4 sm:py-2 sm:text-xs">
                🎟 <span>{joining ? t('entering') : (inviterName ? t('enter_invited_by').replace('{name}', inviterName) : t('enter_invited'))}</span>
              </button>
            )}
            {currentUserId && !isMember && !inviteForHere && (
              door === 'open' ? (
                <button onClick={handleStepIn} disabled={joining} className="flex items-center gap-1 rounded-full btn-theme px-2.5 py-1.5 text-[11px] font-bold text-white transition-colors disabled:opacity-50 sm:px-4 sm:py-2 sm:text-xs">
                  <Icons.Users size={14} /><span>{joining ? t('stepping_in') : t('step_in')}</span>
                </button>
              ) : door === 'closed' ? (
                <span className="flex items-center gap-1 rounded-full border border-slate-400/40 bg-slate-400/10 px-2.5 py-1.5 text-[11px] font-bold text-slate-300 sm:px-4 sm:py-2 sm:text-xs">
                  {t('door_closed_short')}
                </span>
              ) : joinRequested ? (
                <span className="flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2.5 py-1.5 text-[11px] font-bold text-emerald-300 sm:px-4 sm:py-2 sm:text-xs">
                  <Icons.Users size={14} /> {t('requested')}
                </span>
              ) : (
                <button onClick={handleJoin} disabled={joining} className="flex items-center gap-1 rounded-full btn-theme px-2.5 py-1.5 text-[11px] font-bold text-white transition-colors disabled:opacity-50 sm:px-4 sm:py-2 sm:text-xs">
                  <Icons.Users size={14} /><span>{joining ? t('asking') : t('join')}</span>
                </button>
              )
            )}
            {isMember && currentUserId !== community.anchorUid && (
              <span className="flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2.5 py-1.5 text-[11px] font-bold text-emerald-300 sm:px-4 sm:py-2 sm:text-xs">
                <Icons.Users size={14} /> {t('member_badge')}
              </span>
            )}
            {/* Ask to KEEP — a member who isn't a keeper may knock for keepership. */}
            {isMember && currentUserId && !canEdit && (
              <button onClick={handleAskToKeep} disabled={keepAsking}
                className={`flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-bold transition-colors disabled:opacity-50 sm:px-4 sm:py-2 sm:text-xs ${keepRequested
                  ? 'border border-violet-400/40 bg-violet-400/10 text-violet-300 hover:bg-violet-400/20'
                  : 'border border-violet-300/40 bg-violet-500/15 text-violet-200 hover:bg-violet-500 hover:text-white'}`}>
                🗝 <span>{keepRequested ? t('withdraw_ask') : t('ask_to_keep')}</span>
              </button>
            )}
            {onEnterCommunityView && (
              <button onClick={() => onEnterCommunityView(community)} className="flex items-center gap-1 rounded-full border border-amber-300/40 bg-amber-400/15 p-2 text-xs font-bold text-amber-200 transition-colors hover:bg-amber-400 hover:text-white sm:px-4 sm:py-2" title={t('see_site_as_community')}>
                <Icons.Eye /><span className="hidden sm:inline">{t('switch_community_view')}</span>
              </button>
            )}
            {canDelete && (
              <button onClick={handleDelete} disabled={isDeleting} title={t('delete_community')} aria-label={t('delete_community')} className="relative flex items-center gap-1 rounded-full border border-red-400/30 bg-red-500/15 p-2 text-xs font-bold text-red-300 transition-colors hover:bg-red-500 hover:text-white sm:px-4 sm:py-2">
                <Icons.Trash /><span className="hidden sm:inline">{t('delete')}</span>
                {currentUserId !== community.anchorUid && <SuperDot />}
              </button>
            )}
          </>
        ),
        avatar: (
          <div className="relative flex h-14 w-14 md:h-20 md:w-20 shrink-0 items-center justify-center rounded-full border-4 border-white bg-white shadow-xl dark:bg-slate-900">
            {logoUrl && <FullViewButton src={logoUrl} alt={community.name} className="-bottom-1 -right-1" />}
            {logoUrl ? (
              <Picture size={480} src={logoUrl} className="h-full w-full rounded-full object-cover" alt={`${community.name} ${t('logo')}`} referrerPolicy="no-referrer" />
            ) : (
              <span className="text-slate-300"><Icons.Globe /></span>
            )}
          </div>
        ),
        // The header wears the draft name as it is typed — what you see is what is being saved.
        title: editName || community.name,
        chips: (
          <>
            <span className="inline-flex items-baseline gap-1 text-slate-300">
              <span className="text-base font-bold text-white">{domainTrees.length}</span>
              <span className="text-xs text-slate-400">{domainTrees.length === 1 ? t('tree') : t('trees')}</span>
            </span>
            <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-0.5 text-xs text-slate-300 dark:bg-slate-900/10">
              {t('since_date').replace('{date}', community.createdAt?.toDate ? community.createdAt.toDate().toLocaleDateString() : '—')}
            </span>
            {/* A circle wears its own mark; a community with an address wears the address. */}
            {isTreeCircle(community) ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-violet-400/40 bg-violet-400/10 px-2.5 py-0.5 text-xs font-bold text-violet-300 [&>svg]:h-3.5 [&>svg]:w-3.5">
                <Icons.Venn /> {t('tree_circle_badge')}
              </span>
            ) : community.domain ? (
              <OutwardLink href={community.domain} title={isDomainVerified(community) ? t('domain_verified') : undefined} className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2.5 py-0.5 text-xs font-mono text-emerald-300 hover:bg-emerald-400/20">
                <Icons.Globe size={12} /> {community.domain}
                {isDomainVerified(community) && <span className="font-sans font-bold text-emerald-300">✓</span>}
              </OutwardLink>
            ) : null}
            <LoveButton collection="communities" id={community.id} initialCount={community.loveCount || 0} className="rounded-full border border-white/15 bg-white/10 px-2.5 py-0.5 text-white hover:bg-white/20 dark:bg-slate-900/10" />
          </>
        ),
      }}
    />
  );
};
