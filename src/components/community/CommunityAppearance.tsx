import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { Community } from '../../types';
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
  onSave,
  isSaving,
  saveDisabled,
  status,
}) => {
  const { t } = useLanguage();

  return (
    <div className="space-y-6">
    {/* Custom landing — data, not code: flipping this makes the community's hero image the
        domain's front page (sign-in + events), with the seed behind the corner logo. Saved
        with the Save button below, like every other appearance field. */}
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-white p-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-800">Custom landing page</p>
        <p className="text-xs text-slate-500">Greet visitors on this community's domain with your hero image and a single sign-in — the full seed waits behind the corner logo.</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={editCustomLanding}
        onClick={() => onCustomLandingChange(!editCustomLanding)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors ${editCustomLanding ? 'bg-emerald-500' : 'bg-slate-300'}`}
      >
        <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${editCustomLanding ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </div>
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
    </div>
  );
};
