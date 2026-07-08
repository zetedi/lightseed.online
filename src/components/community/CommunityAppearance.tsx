import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { Icons } from '../ui/Icons';
import { Community } from '../../types';
import { SectionTitle } from '../ui/SectionTitle';
import { normalizeTheme } from '../../utils/theme';
import { nodeDefaultTheme } from '../../hooks/useConfig';
import { AppearanceEditor } from '../ui/AppearanceEditor';

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

// Appearance tab — brand, logo, imagery, theme, footer links and carousel quotes.
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
        theme={editTheme}
        onThemeChange={onThemeChange}
        defaultTheme={nodeDefaultTheme(community.domain)}
        logoUrl={logoUrl}
        onLogoUpload={onLogoUpload}
        uploadingLogo={uploadingLogo}
        heroUrl={heroImageUrl}
        onHeroUpload={onHeroUpload}
        uploadingHero={uploadingHero}
        onRemoveHero={onRemoveHero}
        heroHint={t('hero_hint_community')}
        name={editName}
        onNameChange={onNameChange}
        imageUrls={imageUrls}
        onAddImage={onAddImage}
        onRemoveImage={onRemoveImage}
        uploadingImage={uploadingImage}
      />

      {/* Community links — shown in the site footer. */}
      <div className="mt-8 border-t border-slate-100 pt-6">
        <h4 className="mb-1 text-sm font-bold uppercase tracking-wider text-slate-400">Community links</h4>
        <p className="mb-3 text-xs text-slate-500">Shown in the site footer. Paste a full URL or a handle/number.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-600"><Icons.Instagram size={14} /> Instagram</span>
            <input value={editSocial.instagram || ''} onChange={e => onSocialChange(s => ({ ...s, instagram: e.target.value }))} placeholder="@handle or URL" className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </label>
          <label className="block">
            <span className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-600"><Icons.Telegram size={14} /> Telegram</span>
            <input value={editSocial.telegram || ''} onChange={e => onSocialChange(s => ({ ...s, telegram: e.target.value }))} placeholder="t.me/group or @handle" className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </label>
          <label className="block">
            <span className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-600"><Icons.WhatsApp size={14} /> WhatsApp</span>
            <input value={editSocial.whatsapp || ''} onChange={e => onSocialChange(s => ({ ...s, whatsapp: e.target.value }))} placeholder="wa.me invite link or number" className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </label>
          <label className="block">
            <span className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-600"><Icons.Globe /> Website</span>
            <input value={editSocial.website || ''} onChange={e => onSocialChange(s => ({ ...s, website: e.target.value }))} placeholder="example.com" className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </label>
        </div>
      </div>

      {/* Home carousel quotes — reflections shown to signed-out visitors. */}
      <div className="mt-8 border-t border-slate-100 pt-6">
        <h4 className="mb-1 text-sm font-bold uppercase tracking-wider text-slate-400">Home carousel quotes</h4>
        <p className="mb-3 text-xs text-slate-500">Reflections shown in the signed-out home carousel. Leave empty to use the lightseed defaults.</p>
        <div className="space-y-2">
          {editCarouselQuotes.map((q, i) => (
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
