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
      {/* Logo + optional name */}
      <div className="grid gap-6 md:grid-cols-[160px_1fr]">
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase text-slate-400">{logoLabel || t('logo')}</label>
          <ImagePicker onImageSelect={onLogoUpload} previewUrl={logoUrl} loading={uploadingLogo} className="aspect-square w-full max-w-[160px] rounded-2xl border-2 border-dashed border-slate-200" />
          <p className="text-[11px] leading-snug text-slate-400">{logoHint || t('logo_hint')}</p>
        </div>
        {onNameChange && (
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase text-slate-400">{nameLabel || t('community_name')}</label>
            <input dir="auto" type="text" value={name || ''} onChange={e => onNameChange(e.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
        )}
      </div>

      {/* Hero image */}
      <div className="space-y-2">
        <label className="text-[10px] font-bold uppercase text-slate-400">{t('site_hero')}</label>
        <ImagePicker onImageSelect={onHeroUpload} previewUrl={heroUrl} loading={uploadingHero} className="aspect-[3/1] w-full overflow-hidden rounded-2xl border-2 border-dashed border-slate-200" />
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] leading-snug text-slate-400">{heroHint || t('site_hero_desc')}</p>
          {heroUrl && onRemoveHero && (
            <button type="button" onClick={onRemoveHero} className="shrink-0 text-[11px] font-bold text-red-500 hover:text-red-600">{t('remove')}</button>
          )}
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
