import React from 'react';
import { Icons } from './Icons';
import type { Community } from '../../types';
import { headerSurface } from '../../src/domain/themeSurface';

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
// community (or the node) curates its own. Renders only the links that are set. Themed to match
// the navigation header (same surface colours).
export const Footer = ({ community, theme, isDark = false }: { community?: Community | null; theme?: any; isDark?: boolean }) => {
  const surface = headerSurface(theme, isDark);
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
    <footer className="relative z-10 mt-16 border-t px-6 py-3"
            style={{ backgroundColor: surface.background, color: surface.text, borderColor: surface.border }}>
      <div className="mx-auto flex min-h-[3.5rem] max-w-5xl flex-col items-center justify-center gap-x-6 gap-y-1.5 sm:flex-row sm:justify-between">
        {links.length > 0 ? (
          <div className="order-1 flex items-center gap-2 sm:order-1">
            {links.map(l => (
              <a key={l.label} href={l.href} target="_blank" rel="noreferrer" title={l.label} aria-label={l.label}
                 className={`flex h-9 w-9 items-center justify-center rounded-full border transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${surface.isDark ? 'bg-white/10 hover:bg-white/20' : 'bg-black/5 hover:bg-black/10'}`}
                 style={{ borderColor: surface.border }}>
                {l.icon}
              </a>
            ))}
          </div>
        ) : <span className="hidden sm:block" />}
        <p className="order-2 text-sm font-medium" style={{ color: surface.text }}>
          <span dir="ltr" className="font-bold" style={{ color: surface.border }}>.seed</span>
          <span className="mx-2 opacity-40">·</span>{name}
          <span className="mx-2 opacity-40">·</span>{year}
        </p>
        <p className="order-3 text-xs italic" style={{ color: surface.muted }}>life recognising life</p>
      </div>
    </footer>
  );
};
