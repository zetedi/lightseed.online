import React from 'react';
import { linkTarget, linkLabel } from '../../domain/webLink';

// THE ONE DOOR OUTWARD (ring 2026-09-11). Every link a being carries — a vision's page, a tree's
// site, an offering's detail, an organisation's home — is rendered through here, so the law in
// domain/webLink decides three things in one place: the href is absolute (a bare `example.com`
// is a PATH to a browser, which is how a door once opened onto our own shell), a door to another
// house opens in a new tab with the opener sealed, and a door back into this shell opens where
// the reader stands. A value that is not a web link renders nothing rather than a trap.
export const OutwardLink = ({ href, children, ...rest }: {
  href?: string | null;
  // Absent children: the address itself is the label, without the scheme's noise.
  children?: React.ReactNode;
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'target' | 'rel' | 'children'>) => {
  const here = typeof window !== 'undefined' ? window.location.hostname : '';
  const target = linkTarget(href, here);
  if (!target) return null;
  return (
    <a {...rest} href={target.href} target={target.target} rel={target.rel}>
      {children ?? linkLabel(href)}
    </a>
  );
};
