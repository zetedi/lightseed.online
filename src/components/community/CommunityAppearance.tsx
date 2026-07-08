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
  onSave,
  isSaving,
  saveDisabled,
  status,
}) => {
  const { t } = useLanguage();

  return (
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
  );
};
