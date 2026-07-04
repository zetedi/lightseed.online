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
export const ThemeEditor = ({ value, onChange, defaultTheme }: { value: ThemeValue; onChange: (theme: ThemeValue) => void; defaultTheme?: ThemeValue }) => {
  const { t } = useLanguage();
  // Which preset (if any) the current value IS — derived, so editing a colour that diverges from a
  // preset automatically flips the selection to Custom, and matching one re-highlights it.
  const activePreset = communityThemePresets.find(p => themeEquals(value, p));
  const isCustom = !activePreset;
  // The per-colour pickers reveal once the value is custom, or as soon as the user opens the editor
  // by clicking a preset / Custom — so picking a preset brings up its colours, prefilled, to tweak.
  const [expanded, setExpanded] = useState(isCustom);

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2">
        {communityThemePresets.map((preset) => {
          const active = activePreset?.id === preset.id;
          return (
            <button key={preset.id} type="button" onClick={() => { onChange(normalizeTheme(preset)); setExpanded(true); }} className={`w-full rounded-2xl border p-3 text-left transition-all ${active ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}>
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
        <button type="button" onClick={() => setExpanded(true)} className={`w-full rounded-2xl border p-3 text-left transition-all ${isCustom ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}>
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

      {/* Reset to this node's default theme — the theme this profile/community inherits when it
          isn't overridden. Only shown when a default is supplied and the value has drifted from it. */}
      {defaultTheme && !themeEquals(value, defaultTheme) && (
        <button type="button" onClick={() => onChange(normalizeTheme(defaultTheme))} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-emerald-300 hover:text-emerald-700">
          <span aria-hidden>↺</span> {t('theme_reset_default')}
        </button>
      )}

      {/* Per-colour pickers appear in custom mode, or once the editor is expanded via a preset. */}
      {(isCustom || expanded) && (
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
