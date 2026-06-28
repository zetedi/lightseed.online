import React from 'react';
import { Icons } from './Icons';
import type { Community } from '../../types';

// Normalise a stored value (a full URL, a @handle, or a phone number) into a link.
const toUrl = (raw: string | undefined, kind: 'instagram' | 'telegram' | 'whatsapp' | 'website'): string => {
  const v = (raw || '').trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  if (kind === 'instagram') return `https://instagram.com/${v.replace(/^@/, '')}`;
  if (kind === 'telegram') return `https://t.me/${v.replace(/^@/, '')}`;
  if (kind === 'whatsapp') return `https://wa.me/${v.replace(/[^0-9]/g, '')}`;
  return `https://${v}`;
};

// The site footer. Social links come from the active/host community's settings, so each
// community (or the node) curates its own. Renders only the links that are set.
export const Footer = ({ community }: { community?: Community | null }) => {
  const s = community?.socialLinks || {};
  const links: { href: string; label: string; icon: React.ReactNode }[] = [
    { href: toUrl(s.instagram, 'instagram'), label: 'Instagram', icon: <Icons.Instagram size={22} /> },
    { href: toUrl(s.telegram, 'telegram'), label: 'Telegram', icon: <Icons.Telegram size={22} /> },
    { href: toUrl(s.whatsapp, 'whatsapp'), label: 'WhatsApp', icon: <Icons.WhatsApp size={22} /> },
    { href: toUrl(s.website, 'website'), label: 'Website', icon: <Icons.Globe /> },
  ].filter(l => l.href);

  const name = community?.name || 'lightseed';
  const year = new Date().getFullYear();

  return (
    <footer className="relative z-10 mt-16 border-t border-slate-200/60 bg-white/40 px-6 py-8 text-center backdrop-blur-sm">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-4">
        {links.length > 0 && (
          <div className="flex items-center gap-5">
            {links.map(l => (
              <a key={l.label} href={l.href} target="_blank" rel="noreferrer" title={l.label} aria-label={l.label}
                 className="text-slate-400 transition-colors hover:text-emerald-600">
                {l.icon}
              </a>
            ))}
          </div>
        )}
        <p className="text-xs text-slate-400">
          <span dir="ltr" className="font-semibold text-emerald-700/80">.seed</span> · {name} · {year}
        </p>
        <p className="text-[11px] italic text-slate-400/90">life recognising life</p>
      </div>
    </footer>
  );
};
