import React from 'react';
import { Icons } from './Icons';
import { ImagePicker } from './ImagePicker';
import { ThemeEditor, type ThemeValue } from './ThemeEditor';
import { useLanguage } from '../../contexts/LanguageContext';

/**
 * One appearance editor shared by communities and people: a square logo, an optional name,
 * a wide hero banner, an optional gallery, and the theme. The community profile is the
 * reference; a person uses the same structure minus the name/gallery.
 *
 * Save controls and section titles stay with each parent (their persistence differs).
 */
export const AppearanceEditor = ({
  theme, onThemeChange,
  logoUrl, onLogoUpload, uploadingLogo, logoLabel, logoHint,
  heroUrl, onHeroUpload, uploadingHero, onRemoveHero, heroHint,
  name, onNameChange, nameLabel,
  imageUrls, onAddImage, onRemoveImage, uploadingImage,
}: {
  theme: ThemeValue;
  onThemeChange: (t: ThemeValue) => void;
  logoUrl: string;
  onLogoUpload: (file: File) => void;
  uploadingLogo?: boolean;
  logoLabel?: string;
  logoHint?: string;
  heroUrl: string;
  onHeroUpload: (file: File) => void;
  uploadingHero?: boolean;
  onRemoveHero?: () => void;
  heroHint?: string;
  name?: string;
  onNameChange?: (v: string) => void;
  nameLabel?: string;
  imageUrls?: string[];
  onAddImage?: (file: File) => void;
  onRemoveImage?: (index: number) => void;
  uploadingImage?: boolean;
}) => {
  const { t } = useLanguage();
  return (
    <div className="space-y-6">
      {/* WYSIWYG header — mirrors the live hero: a wide banner with the logo badge (and
          name) resting over it. Click the banner to set the hero, the circle to set the logo. */}
      <div className="space-y-2">
        <label className="text-[10px] font-bold uppercase text-slate-400">{t('appearance_header')}</label>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-slate-800 to-slate-900 shadow-inner">
          {/* Hero banner — the background, and itself the hero picker */}
          <ImagePicker onImageSelect={onHeroUpload} previewUrl={heroUrl} loading={uploadingHero} isDark className="aspect-[3/1] min-h-[150px] w-full" />
          {heroUrl && <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-slate-900/40 via-slate-900/45 to-slate-900/80" />}
          {heroUrl && onRemoveHero && (
            <button type="button" onClick={onRemoveHero} className="absolute right-2 top-2 z-20 rounded-full bg-black/40 px-2.5 py-1 text-[11px] font-bold text-white/90 backdrop-blur transition-colors hover:bg-red-500">{t('remove')}</button>
          )}
          {/* Logo badge + name, overlaid exactly like the real header */}
          <div className="pointer-events-none absolute inset-x-4 bottom-4 z-10 flex items-center gap-4">
            <div className="pointer-events-auto h-16 w-16 shrink-0 overflow-hidden rounded-full border-4 border-white bg-white shadow-xl md:h-20 md:w-20">
              <ImagePicker onImageSelect={onLogoUpload} loading={uploadingLogo} className="flex h-full w-full cursor-pointer items-center justify-center text-slate-400">
                {logoUrl ? <img src={logoUrl} className="h-full w-full object-cover" alt="" /> : <Icons.Camera />}
              </ImagePicker>
            </div>
            {onNameChange && (
              <input dir="auto" type="text" value={name || ''} onChange={e => onNameChange(e.target.value)} placeholder={nameLabel || t('community_name')} className="pointer-events-auto min-w-0 flex-1 rounded-lg border border-white/20 bg-black/30 px-3 py-1.5 text-lg font-light tracking-wide text-white placeholder-white/50 backdrop-blur focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            )}
          </div>
        </div>
        {/* Hints live below the preview — no overlap with the imagery */}
        <p className="text-[11px] leading-snug text-slate-400">{t('appearance_header_hint')}</p>
        <div className="flex flex-col gap-0.5 text-[11px] leading-snug text-slate-400 sm:flex-row sm:flex-wrap sm:gap-x-5">
          <span><span className="font-semibold text-slate-500">{logoLabel || t('logo')}:</span> {logoHint || t('logo_hint')}</span>
          <span><span className="font-semibold text-slate-500">{t('site_hero')}:</span> {heroHint || t('site_hero_desc')}</span>
        </div>
      </div>

      {/* Gallery (communities only) */}
      {imageUrls && onAddImage && onRemoveImage && (
        <div>
          <label className="mb-2 block text-[10px] font-bold uppercase text-slate-400">{t('gallery')}</label>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {imageUrls.map((url, index) => (
              <div key={url} className="relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                <img src={url} className="h-full w-full object-cover" alt="" />
                <button type="button" onClick={() => onRemoveImage(index)} className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-red-500 shadow-sm" title={t('remove')}>
                  <Icons.Close />
                </button>
              </div>
            ))}
            <ImagePicker onImageSelect={onAddImage} loading={uploadingImage} className="flex aspect-square cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 text-slate-400 hover:border-emerald-400 hover:text-emerald-600">
              <Icons.Plus />
            </ImagePicker>
          </div>
        </div>
      )}

      {/* Theme */}
      <div>
        <label className="mb-2 block text-[10px] font-bold uppercase text-slate-400">{t('theme_mood')}</label>
        <ThemeEditor value={theme} onChange={onThemeChange} />
      </div>
    </div>
  );
};
