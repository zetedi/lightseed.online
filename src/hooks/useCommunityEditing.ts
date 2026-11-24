import { useEffect, useMemo, useRef, useState } from 'react';
import { updateCommunity, uploadImage, releasePicture, deleteCommunity, getCommunityByDomain } from '@backend';
import type { Community } from '../types';
import { COMMUNITY_APPEARANCE_FIELDS, reconcile, sameValue } from '../domain/autosave';
import { featuredVideoLinks } from '../domain/featuredVideo';
import { mailWordsOf } from '../domain/mailVoice';
import { VISION_KEY, papersOf, visionOf, withVision, type Paper } from '../domain/papers';
import { normalizeTheme } from '../utils/theme';
import { speak } from '../utils/translations';
import { useLanguage } from '../contexts/LanguageContext';
import { useAutosave } from './useAutosave';
import { showAlert, showConfirm } from '../services/dialogBus';
import { notify } from '../services/toastBus';

// A KEEPER'S HAND ON A COMMUNITY'S FACE — the editable copies of its fields, the live
// appearance autosave and its reconcile with the store, the Vision tab's deliberate Save, the
// picture uploads, and the delete. Lifted whole out of CommunityProfile (ring 2026-11-19).
// The rules are the law of who may write; the face decides who is shown these hands.
export const useCommunityEditing = (
  community: Community,
  onUpdate: ((updates: Partial<Community>) => void) | undefined,
  onClose: () => void,
) => {
  const { t } = useLanguage();
  // Editable copies of the community fields (branding + vision).
  const [editName, setEditName] = useState(community.name);
  const [editVision, setEditVision] = useState(visionOf(community));
  // THE PAPERS (ring 2026-09-21; domain/papers): the chapters beside the vision, edited on the
  // Vision tab and saved with it — the vision is papers[0], the rest follow.
  const [editPapers, setEditPapers] = useState<Paper[]>(() => papersOf(community.papers).filter(p => p.key !== VISION_KEY));
  const [editSocial, setEditSocial] = useState<{ instagram?: string; telegram?: string; whatsapp?: string; website?: string }>(community.socialLinks || {});
  const [editFeaturedVideos, setEditFeaturedVideos] = useState<string[]>(() => featuredVideoLinks(community.featuredVideos));
  const [editCarouselQuotes, setEditCarouselQuotes] = useState<string[]>(community.carouselQuotes || []);
  const [editCustomLanding, setEditCustomLanding] = useState(community.customLanding === true);
  const [editShowStats, setEditShowStats] = useState(community.showStats === true);
  const [editLandingPages, setEditLandingPages] = useState<{ id: string; label: string; html: string }[]>(community.landingPages || []);
  const [editTheme, setEditTheme] = useState(normalizeTheme(community.theme));
  // The palette's reach and the letters' words (rings 2026-09-14) — live dials like the rest.
  const [editPaletteReach, setEditPaletteReach] = useState(community.paletteReach === true);
  const [editMail, setEditMail] = useState<{ greeting: string; signature: string; footer: string }>({ greeting: community.mail?.greeting || '', signature: community.mail?.signature || '', footer: community.mail?.footer || '' });
  const [logoUrl, setLogoUrl] = useState(community.logoUrl || '');
  const [heroImageUrl, setHeroImageUrl] = useState(community.heroImageUrl || '');
  const [imageUrls, setImageUrls] = useState<string[]>(community.imageUrls || []);
  const [isUploadingHero, setIsUploadingHero] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  // THE APPEARANCE IS LIVE (ring 2026-09-07): what the hand shapes on the Appearance tab is
  // the draft below; the law (domain/autosave) names what differs from the community as
  // persisted, and the hook writes exactly that a breath after the last change, then hands
  // the patch up (onUpdate) so the shell, the header and every open list wear it. The Vision
  // tab keeps its Save (long-form writing wants a deliberate hand) — handleSave still carries
  // these fields too, harmlessly.
  const appearanceDraft = useMemo(() => ({
    name: editName,
    theme: normalizeTheme(editTheme),
    logoUrl,
    heroImageUrl,
    imageUrls,
    socialLinks: editSocial,
    featuredVideos: featuredVideoLinks(editFeaturedVideos),
    carouselQuotes: editCarouselQuotes.map(q => q.trim()).filter(Boolean),
    customLanding: editCustomLanding,
    showStats: editShowStats,
    landingPages: editLandingPages.filter(p => p.label.trim()),
    paletteReach: editPaletteReach,
    mail: mailWordsOf(editMail),
  }), [editName, editTheme, logoUrl, heroImageUrl, imageUrls, editSocial, editFeaturedVideos, editCarouselQuotes, editCustomLanding, editShowStats, editLandingPages, editPaletteReach, editMail]);
  const appearancePersisted = useMemo(() => ({
    name: community.name,
    theme: normalizeTheme(community.theme),
    logoUrl: community.logoUrl || '',
    heroImageUrl: community.heroImageUrl || '',
    imageUrls: community.imageUrls || [],
    socialLinks: community.socialLinks || {},
    featuredVideos: featuredVideoLinks(community.featuredVideos),
    carouselQuotes: community.carouselQuotes || [],
    customLanding: community.customLanding === true,
    showStats: community.showStats === true,
    landingPages: community.landingPages || [],
    paletteReach: community.paletteReach === true,
    mail: mailWordsOf(community.mail),
  }), [community]);
  const appearanceSave = useAutosave({
    persisted: appearancePersisted,
    draft: appearanceDraft,
    keys: COMMUNITY_APPEARANCE_FIELDS,
    resetKey: community.id,
    save: async (patch) => {
      await updateCommunity(community.id, patch);
      onUpdate?.(patch);
      // A gallery image dropped from the draft leaves the bucket once the document no longer shows it.
      if (patch.imageUrls) for (const gone of appearancePersisted.imageUrls.filter(u => !patch.imageUrls!.includes(u))) releasePicture(gone);
    },
  });
  useEffect(() => {
    if (appearanceSave.state === 'saved') notify(`🌱 ${speak('autosaved')}`);
    if (appearanceSave.state === 'error') notify(speak('err_autosave'), 'error');
  }, [appearanceSave.state]);

  // Keep editable copies in step with the community prop — a RECONCILE, not a reset (ring
  // 2026-09-07): a field this hand has not touched since it last adopted the store follows the
  // fresh value; a field still under the hand keeps its draft (an autosave landing mid-word,
  // or landing while the Vision tab holds unsaved writing, drops nothing). A new community
  // adopts everything.
  const adoptedRef = useRef<{ id: string; fields: typeof appearancePersisted & { vision: string; papers: Paper[] } } | null>(null);
  const imageUrlsKey = (community.imageUrls || []).join(',');
  const featuredVideosKey = featuredVideoLinks(community.featuredVideos).join('\n');
  useEffect(() => {
    const fresh = { ...appearancePersisted, vision: visionOf(community), papers: papersOf(community.papers).filter(p => p.key !== VISION_KEY) };
    const keys = [...COMMUNITY_APPEARANCE_FIELDS, 'vision', 'papers'] as const;
    const adopted = adoptedRef.current?.id === community.id ? adoptedRef.current.fields : null;
    const draft = { ...appearanceDraft, vision: editVision, papers: editPapers };
    const next = adopted ? reconcile(adopted, fresh, draft, keys) : fresh;
    adoptedRef.current = { id: community.id, fields: fresh };
    // eslint-disable-next-line react-hooks/set-state-in-effect -- prop→state reconcile of the editable copies; deriving instead would clobber in-flight edits
    setEditName(next.name);
    setEditVision(next.vision);
    setEditPapers(next.papers);
    setEditSocial(next.socialLinks);
    // The video rows follow the store only when it says something this hand's rows do not: a
    // row still empty is a link not yet written, and laying the stored list back over the rows
    // after every save would close it under the hand.
    if (!sameValue(next.featuredVideos, draft.featuredVideos)) setEditFeaturedVideos(next.featuredVideos);
    setEditTheme(normalizeTheme(next.theme));
    setLogoUrl(next.logoUrl);
    setHeroImageUrl(next.heroImageUrl);
    setImageUrls(next.imageUrls);
    setEditCustomLanding(next.customLanding);
    setEditShowStats(next.showStats);
    setEditLandingPages(next.landingPages);
    setEditPaletteReach(next.paletteReach);
    setEditMail({ greeting: next.mail.greeting || '', signature: next.mail.signature || '', footer: next.mail.footer || '' });
  // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on primitive fields (arrays via imageUrlsKey, featuredVideosKey); object identities change per fetch and would re-run this needlessly; the draft is read, not depended on
  }, [community.id, community.name, community.papers, community.logoUrl, community.heroImageUrl, community.theme, community.customLanding, community.showStats, community.paletteReach, community.mail, featuredVideosKey, imageUrlsKey]);

  const handleSave = async () => {
    setIsSaving(true);
    setStatus(null);
    try {
      const updates = {
        name: editName,
        papers: withVision(editPapers, editVision),
        imageUrls,
        theme: normalizeTheme(editTheme),
        logoUrl,
        heroImageUrl,
        socialLinks: editSocial,
        featuredVideos: featuredVideoLinks(editFeaturedVideos),
        carouselQuotes: editCarouselQuotes.map(q => q.trim()).filter(Boolean),
        customLanding: editCustomLanding,
        showStats: editShowStats,
        landingPages: editLandingPages.filter(p => p.label.trim()),
        paletteReach: editPaletteReach,
        mail: mailWordsOf(editMail),
      };
      await updateCommunity(community.id, updates);
      // Refresh from Firestore so the view reflects exactly what was persisted.
      const fresh = await getCommunityByDomain(community.domain);
      if (onUpdate) onUpdate(fresh ? { ...fresh } : updates);
      setStatus(t('saved'));
      notify(`🌱 ${t('saved')}`);
      setTimeout(() => setStatus(null), 2500);
    } catch (e) {
      console.error(e);
      setStatus(t('err_save_retry'));
      notify(speak('err_save_retry'), 'error');
    }
    setIsSaving(false);
  };

  const handleDelete = async () => {
    if (!(await showConfirm('community_delete_confirm', { title: 'delete_community', confirmText: 'delete', danger: true }))) return;
    setIsDeleting(true);
    try {
      await deleteCommunity(community.id);
      onClose();
      window.location.reload();
    } catch (e) {
      console.error(e);
      showAlert('err_community_delete');
    }
    setIsDeleting(false);
  };

  const handleLogoUpload = async (file: File) => {
    setIsUploadingLogo(true);
    try {
      const url = await uploadImage(file, `communities/${community.id}/logo_${Date.now()}`);
      const previous = logoUrl;
      setLogoUrl(url);
      // Persist immediately so the change can't get lost before the next Save.
      await updateCommunity(community.id, { logoUrl: url });
      onUpdate?.({ logoUrl: url });
      if (previous && previous !== url) releasePicture(previous);
      setStatus(t('saved'));
    } catch (e: any) {
      console.error(e);
      setStatus(speak(e?.message || 'err_logo_upload'));
      notify(speak('err_upload'), 'error');
    }
    setIsUploadingLogo(false);
  };

  const handleHeroUpload = async (file: File) => {
    setIsUploadingHero(true);
    try {
      const url = await uploadImage(file, `communities/${community.id}/hero_${Date.now()}`);
      const previous = heroImageUrl;
      setHeroImageUrl(url);
      await updateCommunity(community.id, { heroImageUrl: url });
      onUpdate?.({ heroImageUrl: url });
      if (previous && previous !== url) releasePicture(previous);
      setStatus(t('saved'));
    } catch (e: any) {
      console.error(e);
      setStatus(speak(e?.message || 'err_hero_upload'));
      notify(speak('err_upload'), 'error');
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
      setStatus(speak(e?.message || 'err_image_upload'));
      notify(speak('err_upload'), 'error');
    }
    setIsUploadingImage(false);
  };

  // A removal or a re-ordering of the gallery (ui/ImageStrip) — the autosave diff releases what left.
  const handleImagesChange = (next: string[]) => setImageUrls(next);

  const handleRemoveHero = () => {
    // Persist immediately (like upload does) — otherwise the old photo returns
    // unless the user also remembers to hit Save.
    const previous = heroImageUrl;
    setHeroImageUrl('');
    updateCommunity(community.id, { heroImageUrl: '' }).then(() => releasePicture(previous)).catch(() => {});
    onUpdate?.({ heroImageUrl: '' });
  };

  return {
    editName, setEditName, editVision, setEditVision, editPapers, setEditPapers,
    editSocial, setEditSocial, editFeaturedVideos, setEditFeaturedVideos, editCarouselQuotes, setEditCarouselQuotes,
    editCustomLanding, setEditCustomLanding, editShowStats, setEditShowStats,
    editLandingPages, setEditLandingPages, editTheme, setEditTheme,
    editPaletteReach, setEditPaletteReach, editMail, setEditMail,
    logoUrl, heroImageUrl, imageUrls,
    isSaving, isDeleting, isUploadingLogo, isUploadingHero, isUploadingImage, status,
    appearanceSave,
    handleSave, handleDelete, handleLogoUpload, handleHeroUpload, handleAddImage, handleImagesChange, handleRemoveHero,
  };
};
