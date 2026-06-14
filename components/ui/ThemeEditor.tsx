import React, { useState } from 'react';
import { communityThemePresets, normalizeTheme, themeEquals, type CommunityThemePreset } from '../../utils/theme';
import { useLanguage } from '../../contexts/LanguageContext';

export type ThemeValue = ReturnType<typeof normalizeTheme>;

const CUSTOM_FIELDS: Array<[keyof CommunityThemePreset, string]> = [
  ['surface', 'color_header'],
  ['primary', 'color_primary'],
  ['accent', 'color_accent'],
  ['background', 'color_background'],
  ['secondary', 'color_secondary'],
  ['neutral', 'color_neutral'],
  ['text', 'color_text'],
];

/**
 * Shared advanced theme editor — presets + a Custom card that unlocks
 * per-colour pickers and a light/dark mode toggle. Used by community/node
 * (CommunityProfile) and user sites (LightseedProfile) so all three share
 * the same functionality.
 */
export const ThemeEditor = ({ value, onChange }: { value: ThemeValue; onChange: (theme: ThemeValue) => void }) => {
  const { t } = useLanguage();
  const [isCustom, setIsCustom] = useState(() => !communityThemePresets.some(p => themeEquals(value, p)));

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2">
        {communityThemePresets.map((preset) => {
          const active = !isCustom && themeEquals(value, preset);
          return (
            <button key={preset.id} type="button" onClick={() => { onChange(normalizeTheme(preset)); setIsCustom(false); }} className={`w-full rounded-2xl border p-3 text-left transition-all ${active ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-slate-800">{preset.name}</div>
                  <div className="text-[11px] text-slate-500">{preset.description}</div>
                </div>
                <div className="flex shrink-0 overflow-hidden rounded-full border border-white shadow-sm">
                  {[preset.surface, preset.primary, preset.accent, preset.background].map((color, index) => (
                    <span key={`${preset.id}-${index}`} className="h-6 w-6" style={{ backgroundColor: color }} />
                  ))}
                </div>
              </div>
            </button>
          );
        })}

        {/* Custom theme — pick each colour separately. */}
        <button type="button" onClick={() => setIsCustom(true)} className={`w-full rounded-2xl border p-3 text-left transition-all ${isCustom ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-bold text-slate-800">{t('theme_custom')}</div>
              <div className="text-[11px] text-slate-500">{t('theme_custom_desc')}</div>
            </div>
            <div className="flex shrink-0 overflow-hidden rounded-full border border-white shadow-sm">
              {[value.surface, value.primary, value.accent, value.background].map((color, index) => (
                <span key={`custom-${index}`} className="h-6 w-6" style={{ backgroundColor: color }} />
              ))}
            </div>
          </div>
        </button>
      </div>

      {/* Per-colour pickers only appear in custom mode. */}
      {isCustom && (
        <div className="space-y-4 rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase text-slate-400">{t('theme_mode')}</span>
            {(['light', 'dark'] as const).map(m => (
              <button key={m} type="button" onClick={() => onChange(normalizeTheme({ ...value, mode: m }))} className={`rounded-full px-3 py-1 text-xs font-bold capitalize transition-colors ${value.mode === m ? 'bg-emerald-600 text-white' : 'bg-white text-slate-500 border border-slate-200 hover:text-slate-800'}`}>
                {m}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {CUSTOM_FIELDS.map(([key, label]) => (
              <label key={key} className="space-y-1">
                <span className="text-[10px] font-bold uppercase text-slate-400">{t(label as any)}</span>
                <input type="color" value={(value as any)[key]} onChange={e => onChange(normalizeTheme({ ...value, [key]: e.target.value }))} className="block h-10 w-full cursor-pointer rounded-lg border border-slate-200 bg-white p-1" />
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
