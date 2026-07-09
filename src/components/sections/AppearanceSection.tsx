import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { Icons } from '../ui/Icons';
import { Community } from '../../types';
import { SectionTitle } from '../ui/SectionTitle';
import { normalizeTheme } from '../../utils/theme';
import { AppearanceEditor } from '../ui/AppearanceEditor';

// Being-generic appearance section — how any being presents itself (Indra's net): name,
// logo, hero, gallery, theme, footer links and carousel quotes. The section is purely
// presentational: every edited field is part of the owner's shared Save, so all draft state
// stays in the owner's shell and arrives via props. CommunityAppearance is a thin wrapper
// over this. (The personal ProfileAppearance still persists per-field on its own with a
// reset flow and a smaller surface, so it stays unbound until the shapes converge.)

// The socialLinks shape is entity-generic footer links; Community is just where it's declared.
export type AppearanceSocialLinks = NonNullable<Community['socialLinks']>;
export type EditableTheme = ReturnType<typeof normalizeTheme>;

interface AppearanceSectionProps {
  name: string;
  onNameChange: (value: string) => void;
  theme: EditableTheme;
  onThemeChange: (theme: EditableTheme) => void;
  // What the entity's theme inherits when it isn't overridden (e.g. the node default).
  defaultTheme?: EditableTheme;
  logoUrl: string;
  onLogoUpload: (file: File) => void;
  uploadingLogo: boolean;
  heroImageUrl: string;
  onHeroUpload: (file: File) => void;
  uploadingHero: boolean;
  onRemoveHero: () => void;
  heroHint?: string;
  imageUrls: string[];
  onAddImage: (file: File) => void;
  onRemoveImage: (index: number) => void;
  uploadingImage: boolean;
  social: AppearanceSocialLinks;
  onSocialChange: React.Dispatch<React.SetStateAction<AppearanceSocialLinks>>;
  carouselQuotes: string[];
  onCarouselQuotesChange: React.Dispatch<React.SetStateAction<string[]>>;
  // Heading over the footer links (the owner names its own anatomy, e.g. "Community links").
  linksTitle?: string;
  onSave: () => void;
  isSaving: boolean;
  saveDisabled: boolean;
  status: string | null;
}

// Appearance section — brand, logo, imagery, theme, footer links and carousel quotes.
export const AppearanceSection: React.FC<AppearanceSectionProps> = ({
  name,
  onNameChange,
  theme,
  onThemeChange,
  defaultTheme,
  logoUrl,
  onLogoUpload,
  uploadingLogo,
  heroImageUrl,
  onHeroUpload,
  uploadingHero,
  onRemoveHero,
  heroHint,
  imageUrls,
  onAddImage,
  onRemoveImage,
  uploadingImage,
  social,
  onSocialChange,
  carouselQuotes,
  onCarouselQuotesChange,
  linksTitle = 'Links',
  onSave,
  isSaving,
  saveDisabled,
  status,
}) => {
  const { t } = useLanguage();

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <SectionTitle title={t('appearance')} sub="Brand, logo, imagery and theme." />
        <div className="flex shrink-0 items-center gap-2">
          <button onClick={onSave} disabled={saveDisabled} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 transition-all hover:bg-emerald-700 disabled:opacity-50">
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
          {status && <span className="text-xs text-slate-500">{status}</span>}
        </div>
      </div>

      <AppearanceEditor
        theme={theme}
        onThemeChange={onThemeChange}
        defaultTheme={defaultTheme}
        logoUrl={logoUrl}
        onLogoUpload={onLogoUpload}
        uploadingLogo={uploadingLogo}
        heroUrl={heroImageUrl}
        onHeroUpload={onHeroUpload}
        uploadingHero={uploadingHero}
        onRemoveHero={onRemoveHero}
        heroHint={heroHint}
        name={name}
        onNameChange={onNameChange}
        imageUrls={imageUrls}
        onAddImage={onAddImage}
        onRemoveImage={onRemoveImage}
        uploadingImage={uploadingImage}
      />

      {/* Footer links — shown in the site footer. */}
      <div className="mt-8 border-t border-slate-100 pt-6">
        <h4 className="mb-1 text-sm font-bold uppercase tracking-wider text-slate-400">{linksTitle}</h4>
        <p className="mb-3 text-xs text-slate-500">Shown in the site footer. Paste a full URL or a handle/number.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-600"><Icons.Instagram size={14} /> Instagram</span>
            <input value={social.instagram || ''} onChange={e => onSocialChange(s => ({ ...s, instagram: e.target.value }))} placeholder="@handle or URL" className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </label>
          <label className="block">
            <span className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-600"><Icons.Telegram size={14} /> Telegram</span>
            <input value={social.telegram || ''} onChange={e => onSocialChange(s => ({ ...s, telegram: e.target.value }))} placeholder="t.me/group or @handle" className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </label>
          <label className="block">
            <span className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-600"><Icons.WhatsApp size={14} /> WhatsApp</span>
            <input value={social.whatsapp || ''} onChange={e => onSocialChange(s => ({ ...s, whatsapp: e.target.value }))} placeholder="wa.me invite link or number" className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </label>
          <label className="block">
            <span className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-600"><Icons.Globe /> Website</span>
            <input value={social.website || ''} onChange={e => onSocialChange(s => ({ ...s, website: e.target.value }))} placeholder="example.com" className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </label>
        </div>
      </div>

      {/* Home carousel quotes — reflections shown to signed-out visitors. */}
      <div className="mt-8 border-t border-slate-100 pt-6">
        <h4 className="mb-1 text-sm font-bold uppercase tracking-wider text-slate-400">Home carousel quotes</h4>
        <p className="mb-3 text-xs text-slate-500">Reflections shown in the signed-out home carousel. Leave empty to use the lightseed defaults.</p>
        <div className="space-y-2">
          {carouselQuotes.map((q, i) => (
            <div key={i} className="flex items-start gap-2">
              <textarea value={q} onChange={e => onCarouselQuotesChange(prev => prev.map((x, j) => j === i ? e.target.value : x))} rows={2} placeholder="A reflection…" className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              <button type="button" onClick={() => onCarouselQuotesChange(prev => prev.filter((_, j) => j !== i))} className="mt-1 shrink-0 rounded-full p-1.5 text-red-500 transition-colors hover:bg-red-50" title="Remove"><Icons.Close /></button>
            </div>
          ))}
          <button type="button" onClick={() => onCarouselQuotesChange(prev => [...prev, ''])} className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50"><Icons.Plus /> Add quote</button>
        </div>
      </div>
    </div>
  );
};
