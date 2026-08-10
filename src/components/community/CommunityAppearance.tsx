import React, { useRef, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { Community } from '../../types';
import RichTextEditor from '../ui/RichTextEditor';
import { uuidv7 } from '../../utils/id';
import { uploadImage } from '../../services/firebase';
import { useCallback } from 'react';
import { normalizeTheme } from '../../utils/theme';
import { nodeDefaultTheme } from '../../hooks/useConfig';
import { AppearanceSection } from '../sections/AppearanceSection';

type SocialLinks = NonNullable<Community['socialLinks']>;
type EditableTheme = ReturnType<typeof normalizeTheme>;

// The appearance tab is presentational: every edited field is part of the shared Save
// (also triggered from the Vision tab), so all draft state stays in the shell.
interface CommunityAppearanceProps {
  community: Community;
  editName: string;
  onNameChange: (value: string) => void;
  editTheme: EditableTheme;
  onThemeChange: (theme: EditableTheme) => void;
  logoUrl: string;
  onLogoUpload: (file: File) => void;
  uploadingLogo: boolean;
  heroImageUrl: string;
  onHeroUpload: (file: File) => void;
  uploadingHero: boolean;
  onRemoveHero: () => void;
  imageUrls: string[];
  onAddImage: (file: File) => void;
  onRemoveImage: (index: number) => void;
  uploadingImage: boolean;
  editSocial: SocialLinks;
  onSocialChange: React.Dispatch<React.SetStateAction<SocialLinks>>;
  editCarouselQuotes: string[];
  onCarouselQuotesChange: React.Dispatch<React.SetStateAction<string[]>>;
  // Custom landing — the org's own full-screen page on its domain (see CustomLandingPage).
  editCustomLanding: boolean;
  onCustomLandingChange: (value: boolean) => void;
  // Show the vanity counts (trees/pulses/visions) on the home cards. Off by default — not numbers.
  editShowStats: boolean;
  onShowStatsChange: (value: boolean) => void;
  // The landing's authored pages (menu panels) — rich text blocks, data not code.
  editLandingPages: { id: string; label: string; html: string }[];
  onLandingPagesChange: React.Dispatch<React.SetStateAction<{ id: string; label: string; html: string }[]>>;
  onSave: () => void;
  isSaving: boolean;
  saveDisabled: boolean;
  status: string | null;
}

// Appearance tab — a thin community binding over the entity-generic AppearanceSection: it
// supplies the node default theme, hero hint and links heading; everything else is shared.
export const CommunityAppearance: React.FC<CommunityAppearanceProps> = ({
  community,
  editName,
  onNameChange,
  editTheme,
  onThemeChange,
  logoUrl,
  onLogoUpload,
  uploadingLogo,
  heroImageUrl,
  onHeroUpload,
  uploadingHero,
  onRemoveHero,
  imageUrls,
  onAddImage,
  onRemoveImage,
  uploadingImage,
  editSocial,
  onSocialChange,
  editCarouselQuotes,
  onCarouselQuotesChange,
  editCustomLanding,
  onCustomLandingChange,
  editShowStats,
  onShowStatsChange,
  editLandingPages,
  onLandingPagesChange,
  onSave,
  isSaving,
  saveDisabled,
  status,
}) => {
  const { t } = useLanguage();
  // A flipped toggle saves itself: the flag notes the intent, and the effect fires onSave only
  // AFTER the new value has round-tripped through the parent — a save on the same tick would
  // persist the stale state (React batches; onSave closes over the parent's current props).
  const autoSave = useRef(false);
  useEffect(() => {
    if (!autoSave.current) return;
    autoSave.current = false;
    onSave();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fires only when a toggle flagged intent; onSave identity churns per render
  }, [editCustomLanding, editShowStats]);
  // Page images go to Storage and embed by URL (stable per community, so the memoized
  // editor toolbar isn't rebuilt each render).
  const handlePageImageUpload = useCallback(
    (file: File) => uploadImage(file, `communities/${community.id}/pages/${Date.now()}`),
    [community.id],
  );

  return (
    <div className="space-y-6">
    <AppearanceSection
      name={editName}
      onNameChange={onNameChange}
      theme={editTheme}
      onThemeChange={onThemeChange}
      defaultTheme={nodeDefaultTheme(community.domain)}
      logoUrl={logoUrl}
      onLogoUpload={onLogoUpload}
      uploadingLogo={uploadingLogo}
      heroImageUrl={heroImageUrl}
      onHeroUpload={onHeroUpload}
      uploadingHero={uploadingHero}
      onRemoveHero={onRemoveHero}
      heroHint={t('hero_hint_community')}
      imageUrls={imageUrls}
      onAddImage={onAddImage}
      onRemoveImage={onRemoveImage}
      uploadingImage={uploadingImage}
      social={editSocial}
      onSocialChange={onSocialChange}
      carouselQuotes={editCarouselQuotes}
      onCarouselQuotesChange={onCarouselQuotesChange}
      linksTitle="Community links"
      onSave={onSave}
      isSaving={isSaving}
      saveDisabled={saveDisabled}
      status={status}
    />

    {/* Custom landing — data, not code: flipping this makes the community's hero image the
        domain's front page (sign-in + events), with the seed behind the corner logo. The
        toggles SAVE THEMSELVES the moment they flip (the effect below); text fields still
        save with the Save button at the top of the page. */}
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-white p-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-800">{t('landing_custom')}</p>
        <p className="text-xs text-slate-500">{t('landing_custom_note')}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={editCustomLanding}
        onClick={() => { autoSave.current = true; onCustomLandingChange(!editCustomLanding); }}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors ${editCustomLanding ? 'bg-emerald-500' : 'bg-slate-300'}`}
      >
        <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${editCustomLanding ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </div>

    {/* Landing pages — the organisation authors its own menu panels (a food menu, an About…)
        as rich text. One generic renderer serves them all; adding a page is data, not code. */}
    {editCustomLanding && (
      <div className="space-y-4 rounded-2xl border border-slate-100 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800">{t('landing_pages')}</p>
            <p className="text-xs text-slate-500">{t('landing_pages_note')}</p>
          </div>
          <button
            type="button"
            onClick={() => onLandingPagesChange(prev => [...prev, { id: uuidv7(), label: t('new_page_label'), html: '' }])}
            className="shrink-0 rounded-full bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white transition-colors hover:bg-emerald-500"
          >
            + {t('add_page')}
          </button>
        </div>
        {editLandingPages.length === 0 && (
          <p className="text-xs text-slate-400">{t('landing_no_pages')}</p>
        )}
        {editLandingPages.map((page, i) => (
          <div key={page.id} className="space-y-2 rounded-xl border border-slate-100 p-3">
            <div className="flex items-center gap-2">
              <input
                value={page.label}
                onChange={e => onLandingPagesChange(prev => prev.map((p, j) => j === i ? { ...p, label: e.target.value } : p))}
                placeholder={t('menu_label_ph')}
                className="h-9 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="button"
                onClick={() => onLandingPagesChange(prev => prev.filter((_, j) => j !== i))}
                className="shrink-0 rounded-lg border border-red-100 bg-white px-2.5 py-1.5 text-xs font-bold text-red-500 transition-colors hover:bg-red-50"
              >
                {t('remove')}
              </button>
            </div>
            <RichTextEditor
              value={page.html}
              onChange={html => onLandingPagesChange(prev => prev.map((p, j) => j === i ? { ...p, html } : p))}
              placeholder={t('page_content_ph')}
              onImageUpload={handlePageImageUpload}
            />
          </div>
        ))}
      </div>
    )}
    {/* Show counts — the trees/pulses/visions tallies on the home cards. Off by default: the home
        stays about the living, not the numbers. */}
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-white p-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-800">{t('home_counts')}</p>
        <p className="text-xs text-slate-500">{t('home_counts_note')}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={editShowStats}
        onClick={() => { autoSave.current = true; onShowStatsChange(!editShowStats); }}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors ${editShowStats ? 'bg-emerald-500' : 'bg-slate-300'}`}
      >
        <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${editShowStats ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </div>

    </div>
  );
};
