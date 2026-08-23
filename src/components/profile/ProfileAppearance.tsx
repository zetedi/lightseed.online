import React, { useState } from 'react';
import { Icons } from '../ui/Icons';
import { useLanguage } from '../../contexts/LanguageContext';
import { updateUserSiteTheme, uploadImage } from '../../services/firebase';
import { normalizeTheme, type CommunityThemePreset } from '../../utils/theme';
import { AppearanceEditor } from '../ui/AppearanceEditor';
import { notify as toast } from '../ui/Toast';

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
  // Inherit (ring 2026-08-24): the personal palette rests; every garden dresses the site.
  siteInherit: boolean;
  onSiteInheritChange: (v: boolean) => void;
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
  siteInherit,
  onSiteInheritChange,
}) => {
  const { t } = useLanguage();
  const [savingSiteTheme, setSavingSiteTheme] = useState(false);
  const [savingInherit, setSavingInherit] = useState(false);

  const handleToggleInherit = async (next: boolean) => {
    setSavingInherit(true);
    onSiteInheritChange(next); // optimistic — the live listener confirms
    try {
      await updateUserSiteTheme(uid, { siteInherit: next });
    } catch (e: any) {
      onSiteInheritChange(!next);
      notify(e?.message || 'Could not save.');
    }
    setSavingInherit(false);
  };
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
      toast('🌱 Your profile theme has been saved.');
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
      toast('Your profile theme has been reset to the node default.');
    } catch (e: any) {
      notify(e.message || 'Failed to reset theme.');
    }
    setSavingSiteTheme(false);
  };

  return (
    <div className="space-y-6">
      {/* INHERIT FROM THE COMMUNITY (ring 2026-08-24) — the first choice, above every dial:
          while on, the personal palette rests and each garden dresses the site in its own
          colors; the settings below step out of sight rather than lie about applying. */}
      <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-500"><Icons.Globe /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-800">{t('site_inherit')}</p>
          <p className="mt-0.5 text-sm text-slate-500">{t('site_inherit_hint')}</p>
        </div>
        <button
          onClick={() => handleToggleInherit(!siteInherit)}
          disabled={savingInherit}
          role="switch"
          aria-checked={siteInherit}
          className={`relative mt-1 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${siteInherit ? 'bg-emerald-600' : 'bg-slate-300'}`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${siteInherit ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>
      {siteInherit ? null : (<>
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
    </>)}
    </div>
  );
};
