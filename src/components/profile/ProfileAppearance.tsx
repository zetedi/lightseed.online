import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Icons } from '../ui/Icons';
import { useLanguage } from '../../contexts/LanguageContext';
import { updateUserSiteTheme, uploadImage, releasePicture } from '../../services/firebase';
import { normalizeTheme, type CommunityThemePreset } from '../../utils/theme';
import { AppearanceEditor } from '../ui/AppearanceEditor';
import { notify as toast } from '../ui/Toast';
import { AutosaveMark } from '../ui/AutosaveMark';
import { useAutosave } from '../../hooks/useAutosave';
import { PERSONAL_APPEARANCE_FIELDS } from '../../domain/autosave';

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

// Appearance tab — the personal profile theme (colors, logo, hero image). LIVE since ring
// 2026-09-07: the palette saves itself a breath after each change, and the shell's listener
// dresses the site in it; the pictures persisted at once already.
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
  // The palette as persisted when this tab opened: the draft is the shell's live state (the
  // listener writes it back after every save, an echo the law reads as no change). Another
  // device's edit arriving mid-session reads as a change and is written back once — harmless.
  const openedWith = useRef({ siteTheme: normalizeTheme(siteTheme) });
  const themeDraft = useMemo(() => ({ siteTheme: normalizeTheme(siteTheme) }), [siteTheme]);
  const themeSave = useAutosave({
    persisted: openedWith.current,
    draft: themeDraft,
    keys: PERSONAL_APPEARANCE_FIELDS,
    resetKey: uid,
    save: (patch) => updateUserSiteTheme(uid, patch),
  });
  useEffect(() => {
    if (themeSave.state === 'saved') toast(`🌱 ${t('autosaved')}`);
    if (themeSave.state === 'error') toast(t('err_autosave'), 'error');
  }, [themeSave.state, t]);

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
      const previous = siteLogoUrl;
      onSiteLogoUrlChange(url);
      // Persist immediately so an upload can't be lost before the next Save.
      await updateUserSiteTheme(uid, { siteTheme: normalizeTheme(siteTheme), siteLogoUrl: url, siteHeroUrl });
      if (previous && previous !== url) releasePicture(previous);
    } catch (e: any) {
      notify(e.message || 'Failed to upload site logo.');
    }
    setUploadingSiteLogo(false);
  };

  const handleSiteHeroUpload = async (file: File) => {
    setUploadingSiteHero(true);
    try {
      const url = await uploadImage(file, `users/${uid}/site-theme/hero_${Date.now()}`);
      const previous = siteHeroUrl;
      onSiteHeroUrlChange(url);
      await updateUserSiteTheme(uid, { siteTheme: normalizeTheme(siteTheme), siteLogoUrl, siteHeroUrl: url });
      if (previous && previous !== url) releasePicture(previous);
    } catch (e: any) {
      notify(e.message || 'Failed to upload hero image.');
    }
    setUploadingSiteHero(false);
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
      const previousLogo = siteLogoUrl; const previousHero = siteHeroUrl;
      await updateUserSiteTheme(uid, {
        siteTheme: resetTheme,
        siteLogoUrl: '',
        siteHeroUrl: '',
      });
      releasePicture(previousLogo); releasePicture(previousHero);
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
      {/* Title + the mark + Reset share the row; the explainer sits UNDER them, small — on mobile
          the old side-by-side layout squeezed it into a nine-line sliver. */}
      <div>
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-bold text-slate-800">{t('appearance_theme_title')}</h3>
          <div className="flex shrink-0 items-center gap-2">
            <AutosaveMark state={themeSave.state} />
            <button
              onClick={handleResetSiteTheme}
              disabled={savingSiteTheme || uploadingSiteLogo || uploadingSiteHero}
              className="rounded-xl bg-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-300 disabled:opacity-50"
            >
              {t('reset')}
            </button>
          </div>
        </div>
        <p className="mt-1.5 text-xs text-slate-500">{t('appearance_theme_desc')} {t('autosave_hint')}</p>
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
          const previous = siteHeroUrl;
          onSiteHeroUrlChange('');
          updateUserSiteTheme(uid, { siteTheme: normalizeTheme(siteTheme), siteLogoUrl, siteHeroUrl: '' }).then(() => releasePicture(previous)).catch(() => {});
        }}
      />
    </>)}
    </div>
  );
};
