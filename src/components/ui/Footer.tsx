import React, { useState } from 'react';
import { Icons } from './Icons';
import type { Community } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { headerSurface } from '../../domain/themeSurface';
import { LegalModal, type LegalDoc } from './LegalModal';
import { subscribeToNewsletter } from '../../services/firebase';
import { isSubscriberEmail } from '../../domain/newsletter';
import { notify } from './Toast';
import { speak } from '../../utils/translations';

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
  const { t } = useLanguage();
  const surface = headerSurface(theme, isDark);
  const s = community?.socialLinks || {};
  const links: { href: string; label: string; icon: React.ReactNode }[] = [
    { href: toUrl(s.instagram, 'instagram'), label: 'Instagram', icon: <Icons.Instagram size={22} /> },
    { href: toUrl(s.telegram, 'telegram'), label: 'Telegram', icon: <Icons.Telegram size={22} /> },
    { href: toUrl(s.whatsapp, 'whatsapp'), label: 'WhatsApp', icon: <Icons.WhatsApp size={22} /> },
    { href: toUrl(s.website, 'website'), label: 'Website', icon: <Icons.Globe /> },
  ].filter(l => l.href);

  // With no community at this door, the footer names the DOOR (its hostname), never the node —
  // an unclaimed door must not wear another place's name (2026-09-09).
  const name = community?.name || (typeof window !== 'undefined' ? window.location.hostname.replace(/^www\./, '') : 'lightseed');
  const year = `2019–${new Date().getFullYear()}`;

  const [legalDoc, setLegalDoc] = useState<LegalDoc | null>(null);

  // THE LETTER OF A PLACE (ring 2026-09-08): the footer is where a visitor subscribes — to the
  // letter of the place they stand on (the host community's canonical domain), never to a
  // node-wide list. Unsubscribing lives in each letter (one click) and in the profile.
  const place = community?.domain || (typeof window !== 'undefined' ? window.location.hostname : '');
  const [email, setEmail] = useState('');
  const [subscribing, setSubscribing] = useState(false);
  const subscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSubscriberEmail(email)) { notify(speak('invalid_email'), 'error'); return; }
    setSubscribing(true);
    try {
      await subscribeToNewsletter(email, place);
      notify(`🌱 ${speak('subscribed_success')} ${email.trim()}`);
      setEmail('');
    } catch {
      notify(speak('subscription_failed'), 'error');
    }
    setSubscribing(false);
  };
  const legal: { doc: LegalDoc; label: string }[] = [
    { doc: 'privacy', label: t('privacy') },
    { doc: 'terms', label: t('terms') },
    { doc: 'imprint', label: t('imprint') },
  ];

  return (
    // Everything centred and stacked: the socials, then the brand line, then the legal links.
    // pb-24 on mobile keeps this clear of the fixed care droplet at the bottom-left.
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

        {/* The letter of this place — subscribe here; unsubscribe in the letter or the profile. */}
        {place && (
          <form onSubmit={subscribe} className="flex w-full max-w-sm flex-col items-center gap-1.5">
            <label htmlFor="footer-subscribe" className="text-[11px]" style={{ color: surface.muted }}>{t('footer_subscribe_label').replace('{place}', name)}</label>
            <div className="flex w-full items-center gap-2">
              <input id="footer-subscribe" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={t('footer_subscribe_ph')} autoComplete="email" disabled={subscribing}
                     className={`h-9 min-w-0 flex-1 rounded-full border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 ${surface.isDark ? 'bg-white/10 text-white placeholder-white/50' : 'bg-white text-slate-800 placeholder-slate-400'}`}
                     style={{ borderColor: surface.border }} />
              <button type="submit" disabled={subscribing || !email} className="h-9 shrink-0 rounded-full bg-emerald-600 px-4 text-xs font-bold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50">{t('footer_subscribe_cta')}</button>
            </div>
          </form>
        )}

        {/* The brand line, below the socials, in the middle. */}
        <p className="text-xs leading-relaxed" style={{ color: surface.muted }}>
          <span className="italic">{t('tagline')}</span>
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
