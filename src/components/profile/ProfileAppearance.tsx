import React, { useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { updateUserSiteTheme, uploadImage } from '../../services/firebase';
import { normalizeTheme, type CommunityThemePreset } from '../../utils/theme';
import { AppearanceEditor } from '../ui/AppearanceEditor';

type EditableTheme = ReturnType<typeof normalizeTheme>;

interface ProfileAppearanceProps {
  uid: string;
  // The node's default theme — what the profile inherits when it isn't overridden.
  nodeTheme?: Partial<CommunityThemePreset>;
  // Theme draft state lives in the shell, where the live profile listener writes it.
  siteTheme: EditableTheme;
  onSiteThemeChange: (theme: EditableTheme) => void;
  siteLogoUrl: string;
  onSiteLogoUrlChange: (url: string) => void;
  siteHeroUrl: string;
  onSiteHeroUrlChange: (url: string) => void;
  // Surfaces notices via the shell's shared dialog modal.
  notify: (message: string) => void;
}

// Appearance tab — the personal profile theme (colors, logo, hero image).
export const ProfileAppearance: React.FC<ProfileAppearanceProps> = ({
  uid,
  nodeTheme,
  siteTheme,
  onSiteThemeChange,
  siteLogoUrl,
  onSiteLogoUrlChange,
  siteHeroUrl,
  onSiteHeroUrlChange,
  notify,
}) => {
  const { t } = useLanguage();
  const [savingSiteTheme, setSavingSiteTheme] = useState(false);
  const [uploadingSiteLogo, setUploadingSiteLogo] = useState(false);
  const [uploadingSiteHero, setUploadingSiteHero] = useState(false);

  const handleSiteLogoUpload = async (file: File) => {
    setUploadingSiteLogo(true);
    try {
      const url = await uploadImage(file, `users/${uid}/site-theme/logo_${Date.now()}`);
      onSiteLogoUrlChange(url);
      // Persist immediately so an upload can't be lost before the next Save.
      await updateUserSiteTheme(uid, { siteTheme: normalizeTheme(siteTheme), siteLogoUrl: url, siteHeroUrl });
    } catch (e: any) {
      notify(e.message || 'Failed to upload site logo.');
    }
    setUploadingSiteLogo(false);
  };

  const handleSiteHeroUpload = async (file: File) => {
    setUploadingSiteHero(true);
    try {
      const url = await uploadImage(file, `users/${uid}/site-theme/hero_${Date.now()}`);
      onSiteHeroUrlChange(url);
      await updateUserSiteTheme(uid, { siteTheme: normalizeTheme(siteTheme), siteLogoUrl, siteHeroUrl: url });
    } catch (e: any) {
      notify(e.message || 'Failed to upload hero image.');
    }
    setUploadingSiteHero(false);
  };

  const handleSaveSiteTheme = async () => {
    setSavingSiteTheme(true);
    try {
      await updateUserSiteTheme(uid, {
        siteTheme: normalizeTheme(siteTheme),
        siteLogoUrl,
        siteHeroUrl,
      });
      notify('Your profile theme has been saved.');
    } catch (e: any) {
      notify(e.message || 'Failed to save theme.');
    }
    setSavingSiteTheme(false);
  };

  const handleResetSiteTheme = async () => {
    // Reset to the node's default theme (what the profile inherits when it isn't overridden),
    // not the generic canopy fallback — so "reset" restores the look the user actually sees.
    const resetTheme = normalizeTheme(nodeTheme);
    setSavingSiteTheme(true);
    try {
      onSiteThemeChange(resetTheme);
      onSiteLogoUrlChange('');
      onSiteHeroUrlChange('');
      await updateUserSiteTheme(uid, {
        siteTheme: resetTheme,
        siteLogoUrl: '',
        siteHeroUrl: '',
      });
      notify('Your profile theme has been reset to the node default.');
    } catch (e: any) {
      notify(e.message || 'Failed to reset theme.');
    }
    setSavingSiteTheme(false);
  };

  return (
    <div className="space-y-6">
      {/* Title + buttons share the row; the explainer sits UNDER them, small — on mobile the
          old side-by-side layout squeezed it into a nine-line sliver. */}
      <div>
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-bold text-slate-800">{t('appearance_theme_title')}</h3>
          <div className="flex shrink-0 gap-2">
            <button
              onClick={handleSaveSiteTheme}
              disabled={savingSiteTheme || uploadingSiteLogo || uploadingSiteHero}
              className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-teal-600/20 transition-colors hover:bg-teal-700 disabled:opacity-50"
            >
              {savingSiteTheme ? t('saving') : t('save_theme')}
            </button>
            <button
              onClick={handleResetSiteTheme}
              disabled={savingSiteTheme || uploadingSiteLogo || uploadingSiteHero}
              className="rounded-xl bg-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-300 disabled:opacity-50"
            >
              {t('reset')}
            </button>
          </div>
        </div>
        <p className="mt-1.5 text-xs text-slate-500">{t('appearance_theme_desc')}</p>
      </div>

      <AppearanceEditor
        theme={siteTheme}
        onThemeChange={onSiteThemeChange}
        defaultTheme={normalizeTheme(nodeTheme)}
        logoUrl={siteLogoUrl}
        onLogoUpload={handleSiteLogoUpload}
        uploadingLogo={uploadingSiteLogo}
        logoLabel={t('site_logo')}
        logoHint={t('site_logo_desc')}
        heroUrl={siteHeroUrl}
        onHeroUpload={handleSiteHeroUpload}
        uploadingHero={uploadingSiteHero}
        onRemoveHero={() => {
          // Persist immediately (like upload does) — no silent revert on reload.
          onSiteHeroUrlChange('');
          updateUserSiteTheme(uid, { siteTheme: normalizeTheme(siteTheme), siteLogoUrl, siteHeroUrl: '' }).catch(() => {});
        }}
      />
    </div>
  );
};
