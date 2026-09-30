import { OutwardLink } from './OutwardLink';
import { Icons } from './Icons';
import { useLanguage } from '../../contexts/LanguageContext';
import { linkLabel, type WebLink } from '../../domain/webLink';

// The doors a record carries outward, rendered through the one outward door (OutwardLink), so
// every address is absolute, another house opens in its own tab, and nothing but a web link
// is ever a door. Silent when there is nothing to show.
export const WebLinksList = ({ links, className = '' }: { links?: WebLink[] | null; className?: string }) => {
  const { t } = useLanguage();
  if (!links || links.length === 0) return null;
  return (
    <div className={`mt-4 ${className}`}>
      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('web_links')}</p>
      <ul className="flex flex-wrap gap-2">
        {links.map((l, i) => (
          <li key={`${l.url}:${i}`}>
            <OutwardLink href={l.url} className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50/60 px-3 py-1.5 text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
              <span className="[&>svg]:h-3.5 [&>svg]:w-3.5"><Icons.Link /></span>
              <span className="truncate">{l.label || linkLabel(l.url)}</span>
            </OutwardLink>
          </li>
        ))}
      </ul>
    </div>
  );
};
