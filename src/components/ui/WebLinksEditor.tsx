import { Icons } from './Icons';
import { useLanguage } from '../../contexts/LanguageContext';
import { MAX_WEB_LINKS, webLinkProblem, type WebLink } from '../../domain/webLink';

// THE DOORS A RECORD CARRIES OUTWARD (ring 2026-09-30): a dynamic list of label + address rows —
// a blog, an album, a shared folder — bounded by the law (MAX_WEB_LINKS), each address judged
// as a person types (domain/webLink webLinkProblem). The rows hold what was typed; the caller
// sanitizes with webLinksOf when it saves.
export interface WebLinkRow { url: string; label: string }
export const rowsOf = (links?: WebLink[] | null): WebLinkRow[] => (links || []).map(l => ({ url: l.url, label: l.label || '' }));

export const WebLinksEditor = ({ rows, onChange, fieldClassName }: {
  rows: WebLinkRow[];
  onChange: (rows: WebLinkRow[]) => void;
  fieldClassName?: string;
}) => {
  const { t } = useLanguage();
  const cls = fieldClassName || 'h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-slate-900 dark:border-slate-700';
  const set = (i: number, patch: Partial<WebLinkRow>) => onChange(rows.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[10px] font-bold uppercase text-slate-400">{t('web_links')}</span>
        <span className="text-[11px] text-slate-400">{t('web_links_hint')}</span>
      </div>
      {rows.map((r, i) => {
        const problem = webLinkProblem(r.url);
        return (
          <div key={i} className="space-y-1">
            <div className="flex gap-2">
              <input dir="auto" value={r.label} onChange={e => set(i, { label: e.target.value })} placeholder={t('web_link_label_ph')} className={`${cls} basis-2/5`} maxLength={80} />
              <input dir="ltr" value={r.url} onChange={e => set(i, { url: e.target.value })} placeholder={t('web_link_url_ph')} className={`${cls} flex-1 ${problem ? 'border-red-300 focus:ring-red-400' : ''}`} inputMode="url" />
              <button type="button" onClick={() => onChange(rows.filter((_, k) => k !== i))} title={t('remove_link')} aria-label={t('remove_link')} className="shrink-0 rounded-full p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500">
                <span className="block [&>svg]:h-4 [&>svg]:w-4"><Icons.Close /></span>
              </button>
            </div>
            {problem && r.url.trim() && <p className="text-[11px] text-red-500">{t(problem)}</p>}
          </div>
        );
      })}
      {rows.length < MAX_WEB_LINKS && (
        <button type="button" onClick={() => onChange([...rows, { url: '', label: '' }])} className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-500 transition-colors hover:border-emerald-400 hover:text-emerald-600 dark:border-slate-700">
          <Icons.Plus /> {t('add_link')}
        </button>
      )}
    </div>
  );
};
