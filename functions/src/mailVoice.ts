// MIRROR of src/domain/mailVoice.ts (ring 2026-09-14) — keep the two in step; tests/mailVoice.test.ts holds them equal.

export interface MailVoiceSource {
  name?: string | null;
  domain?: string | null;
  theme?: { primary?: string | null; text?: string | null; background?: string | null; mode?: string | null } | null;
  mail?: MailWords | null;
}
export interface MailWords { greeting?: string | null; signature?: string | null; footer?: string | null }
// The words as stored: every line clean, absent rather than empty.
export type MailWordsClean = { greeting?: string; signature?: string; footer?: string };
export interface NodeVoice { name: string; origin: string; postal: string }
export interface MailVoice {
  name: string;
  origin: string;
  primary: string;
  ink: string;
  paper: string;
  greeting: string;
  signature: string;
  footer: string;
}

export const MAIL_LINE_MAX = 280;
export const SHELL_MAIL_PRIMARY = '#059669';
export const SHELL_MAIL_INK = '#333333';
export const SHELL_MAIL_PAPER = '#ffffff';
export const MAIL_WORD_KEYS = ['greeting', 'signature', 'footer'] as const;

const hexOf = (v: unknown): string | null =>
  typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v.trim()) ? v.trim().toLowerCase() : null;

const luminance = (hex: string): number => {
  const c = [0, 2, 4].map((i) => {
    const ch = parseInt(hex.slice(1 + i, 3 + i), 16) / 255;
    return ch <= 0.03928 ? ch / 12.92 : Math.pow((ch + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
export const contrastOf = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// A line of a letter: no control characters, whitespace one breath wide, paragraphs kept.
export const mailLine = (raw: unknown): string => {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ ?\r?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAIL_LINE_MAX);
};

// The words a keeper wrote, as they are stored: cleaned, empty ones dropped.
export const mailWordsOf = (raw: MailWords | null | undefined): MailWordsClean => {
  const out: MailWordsClean = {};
  for (const k of MAIL_WORD_KEYS) { const v = mailLine(raw?.[k]); if (v) out[k] = v; }
  return out;
};

export const mailVoiceOf = (source: MailVoiceSource | null | undefined, node: NodeVoice): MailVoice => {
  const name = mailLine(source?.name) || node.name;
  const domain = (source?.domain || '').trim().toLowerCase().replace(/^www\./, '');
  const origin = /^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain) ? `https://${domain}` : node.origin;
  const light = (source?.theme?.mode || 'light') !== 'dark';
  const ink = light ? hexOf(source?.theme?.text) : null;
  const paper = light ? hexOf(source?.theme?.background) : null;
  const reads = !!(ink && paper && contrastOf(ink, paper) >= 3);
  const words = mailWordsOf(source?.mail);
  return {
    name,
    origin,
    primary: hexOf(source?.theme?.primary) || SHELL_MAIL_PRIMARY,
    ink: reads ? ink! : SHELL_MAIL_INK,
    paper: reads ? paper! : SHELL_MAIL_PAPER,
    greeting: words.greeting || '',
    signature: words.signature || '',
    footer: words.footer || node.postal,
  };
};

// The words of a letter, dressed: the greeting before, the signature after — only where the
// place wrote them; the node's own letters stay bare.
export const dressMailText = (text: string, voice: Pick<MailVoice, 'greeting' | 'signature'>): string =>
  [voice.greeting, text.trim(), voice.signature].filter(Boolean).join('\n\n');
