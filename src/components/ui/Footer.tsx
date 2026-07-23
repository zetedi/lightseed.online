import React, { useState } from 'react';
import { Icons } from './Icons';
import type { Community } from '../../types';
import { headerSurface } from '../../domain/themeSurface';
import { LegalModal, type LegalDoc } from './LegalModal';

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
  const year = `2019–${new Date().getFullYear()}`;

  const [legalDoc, setLegalDoc] = useState<LegalDoc | null>(null);
  const legal: { doc: LegalDoc; label: string }[] = [
    { doc: 'privacy', label: 'Privacy' },
    { doc: 'terms', label: 'Terms' },
    { doc: 'imprint', label: 'Imprint' },
  ];

  return (
    // Everything centred and stacked: the socials, then the brand line, then the legal links.
    // pb-24 on mobile keeps this clear of the fixed tend droplet at the bottom-left.
    <footer className="relative z-10 border-t px-6 pb-24 pt-4 sm:pb-4"
            style={{ backgroundColor: surface.background, color: surface.text, borderColor: surface.border }}>
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-2.5 text-center">
        {links.length > 0 && (
          <div className="flex items-center gap-2">
            {links.map(l => (
              <a key={l.label} href={l.href} target="_blank" rel="noreferrer" title={l.label} aria-label={l.label}
                 className={`flex h-8 w-8 items-center justify-center rounded-full border transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${surface.isDark ? 'bg-white/10 hover:bg-white/20' : 'bg-black/5 hover:bg-black/10'}`}
                 style={{ borderColor: surface.border }}>
                {l.icon}
              </a>
            ))}
          </div>
        )}

        {/* The brand line, below the socials, in the middle. */}
        <p className="text-xs leading-relaxed" style={{ color: surface.muted }}>
          <span className="italic">life recognising life</span>
          <span className="mx-1.5 opacity-40">·</span>
          <span dir="ltr" className="font-bold not-italic" style={{ color: surface.border }}>.seed</span>
          <span className="mx-1.5 opacity-40">·</span>{name}
          <span className="mx-1.5 opacity-40">·</span>{year}
        </p>

        {/* Privacy · Terms · Imprint — each opens in a responsive modal. */}
        <div className="flex items-center gap-3 text-[11px]" style={{ color: surface.muted }}>
          {legal.map((l, i) => (
            <React.Fragment key={l.doc}>
              {i > 0 && <span className="opacity-30">·</span>}
              <button type="button" onClick={() => setLegalDoc(l.doc)} className="transition-opacity hover:opacity-100 hover:underline" style={{ opacity: 0.75 }}>{l.label}</button>
            </React.Fragment>
          ))}
        </div>
      </div>

      {legalDoc && <LegalModal doc={legalDoc} nodeName={name} onClose={() => setLegalDoc(null)} />}
    </footer>
  );
};
