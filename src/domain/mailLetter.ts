// THE LETTERS A NODE WRITES (ring 2026-11-03) — the pure half of the mail organ. The origin node
// composes every outbound mail server-side in functions/src (core.composeSystemEmailHtml, mail.ts
// onReachCreated, invites.ts onJoinRequestCreated, letters.ts); the independent node composes the
// same letters with this law and hands them to its courier (seed/api/mail.mjs). Nothing here sends:
// this file knows words, shapes and refusals. Plain contract: the system letter, the reach notice,
// the keeper's knock, the welcome and the newsletter footer are transcriptions of the functions
// originals (checked by hand on 2026-11-03, not test-held — functions/src/core.ts cannot be imported
// by the root suite); one deliberate difference: every link lands in an attribute escaped.
import { dressMailText, type MailVoice } from './mailVoice';

export const MAIL_DAILY_LIMIT = 20;            // letters a non-staff hand may trigger per UTC day (functions DAILY_EMAIL_LIMIT)
export const MAIL_MAX_RECIPIENTS = 5;          // one system letter's recipients
export const MAIL_KNOCK_RECIPIENTS = 6;        // a join request knocks on the anchor and a few stewards, never a blast
export const REACH_THROTTLE_MS = 10 * 60 * 1000; // one reach letter per thread per recipient inside this window
export const MAIL_MAX_ATTEMPTS = 5;            // deliveries tried before a letter is marked ERROR
export const MAIL_RETRY_BASE_MS = 60_000;
export const MAIL_RETRY_MAX_MS = 60 * 60_000;
export const OUTBOX_STALE_MS = 24 * 60 * 60_000; // an effect older than this is never delivered late

export const MAIL_ADDRESS = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

// ── THE SYSTEM LETTER: plain words and an optional validated link, dressed in a voice ─────────
export type SystemMailRefusal = 'mail_no_recipient' | 'mail_too_many' | 'mail_bad_recipient' | 'mail_bad_link';
export interface SystemMailAsk { to: unknown; subject?: unknown; text?: unknown; ctaUrl?: unknown; ctaLabel?: unknown }
export interface SystemMail { recipients: string[]; subject: string; text: string; ctaUrl: string; ctaLabel: string }

// What a hand may ask the node to send (mirror of functions sendSystemEmail's validation).
export const systemMailOf = (ask: SystemMailAsk, nodeName: string): SystemMail | { refusal: SystemMailRefusal } => {
  const raw = Array.isArray(ask.to) ? ask.to : [ask.to];
  const recipients = raw.filter((x): x is string => typeof x === 'string' && !!x.trim()).map(x => x.trim());
  const subject = str(ask.subject).slice(0, 200) || `A message from ${nodeName}`;
  const text = str(ask.text).slice(0, 4000);
  const ctaUrl = ask.ctaUrl ? str(ask.ctaUrl).slice(0, 500) : '';
  const ctaLabel = ask.ctaLabel ? str(ask.ctaLabel).slice(0, 80) : 'Open';
  if (!recipients.length) return { refusal: 'mail_no_recipient' };
  if (recipients.length > MAIL_MAX_RECIPIENTS) return { refusal: 'mail_too_many' };
  if (!recipients.every(r => MAIL_ADDRESS.test(r))) return { refusal: 'mail_bad_recipient' };
  if (ctaUrl && !/^https?:\/\//i.test(ctaUrl)) return { refusal: 'mail_bad_link' };
  return { recipients, subject, text, ctaUrl, ctaLabel };
};

export interface Letter { html: string; text: string }

// The branded shell (functions core.composeSystemEmailHtml) and its plain twin.
export const systemLetterOf = (text: string, ctaUrl: string, ctaLabel: string, voice: MailVoice): Letter => {
  const body = escapeHtml(dressMailText(text, voice)).replace(/\n/g, '<br>');
  const href = escapeHtml(ctaUrl);
  const cta = ctaUrl
    ? `<div style="margin:24px 0;"><a href="${href}" style="display:inline-block;background:${voice.primary};color:#fff;text-decoration:none;font-weight:bold;padding:12px 26px;border-radius:9999px;font-size:15px;">${escapeHtml(ctaLabel)}</a></div><p style="font-size:12px;color:#9ca3af;">Or paste this link:<br/><a href="${href}" style="color:${voice.primary};word-break:break-all;">${escapeHtml(ctaUrl)}</a></p>`
    : '';
  const html = `<div style="font-family: sans-serif; line-height: 1.6; color: ${voice.ink}; background: ${voice.paper}; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;"><h2 style="color: ${voice.primary}; font-weight: 300; letter-spacing: 1px; margin-bottom: 20px;">${escapeHtml(voice.name)}</h2><div style="font-size: 16px; margin-bottom: 8px;">${body}</div>${cta}<hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" /><p style="font-size: 12px; color: #9ca3af; text-align: center;">Sent from <a href="${escapeHtml(voice.origin)}" style="color: ${voice.primary}; text-decoration: none;">${escapeHtml(voice.name)}</a> on the Lifetree Network<br/>${escapeHtml(voice.footer)}</p></div>`;
  return { html, text: ctaUrl ? `${dressMailText(text, voice)}\n\n${ctaUrl}` : dressMailText(text, voice) };
};

// ── THE REACH NOTICE: who is written to, when a thread is quiet enough, what is said ──────────
export interface ReachPulse {
  type?: unknown; authorId?: unknown; authorName?: unknown; recipientUid?: unknown; recipientName?: unknown;
  participantUids?: unknown; isGroup?: unknown; threadId?: unknown; threadName?: unknown; reachTreeId?: unknown;
  reachTreeName?: unknown; lifetreeId?: unknown; content?: unknown; body?: unknown;
}
const participantsOf = (pulse: ReachPulse): string[] =>
  Array.isArray(pulse.participantUids) ? pulse.participantUids.filter((u): u is string => typeof u === 'string') : [];
// Everyone in the thread for a group reach, the one addressed for a 1:1 — never the author.
export const reachRecipientsOf = (pulse: ReachPulse): string[] => {
  const participants = participantsOf(pulse);
  const recipient = str(pulse.recipientUid);
  return [...new Set((participants.length ? participants : recipient ? [recipient] : []).filter(uid => uid && uid !== pulse.authorId))];
};
export const reachIsGroup = (pulse: ReachPulse): boolean => {
  const participants = participantsOf(pulse);
  return participants.length > 0 && (pulse.isGroup === true || participants.length > 2);
};
// The thread a throttle counts by (functions onReachCreated threadKey).
export const reachThreadKeyOf = (pulse: ReachPulse): string =>
  (str(pulse.threadId) || `${str(pulse.reachTreeId)}_${str(pulse.lifetreeId)}`).replace(/\//g, '_');
export const reachThrottleIdOf = (recipientUid: string, pulse: ReachPulse): string => `${recipientUid}__${reachThreadKeyOf(pulse)}`;
// A recipient is written to when they did not opt out and the thread was quiet for the window.
export const reachMayWrite = (f: { directMessages?: unknown; email?: unknown; lastSentAtMs: number | null; nowMs: number }): boolean =>
  f.directMessages !== false && typeof f.email === 'string' && MAIL_ADDRESS.test(f.email)
  && (f.lastSentAtMs === null || f.nowMs - f.lastSentAtMs >= REACH_THROTTLE_MS);

export interface ReachLetter extends Letter { subject: string }
export const reachLetterOf = (pulse: ReachPulse, voice: MailVoice, nodeName: string): ReachLetter => {
  const message = str(pulse.content) || str(pulse.body);
  const fromName = str(pulse.authorName) || 'A Lifetree';
  const isGroup = reachIsGroup(pulse);
  const audienceName = str(pulse.threadName) || str(pulse.reachTreeName) || 'a circle';
  const toName = isGroup ? audienceName : (str(pulse.recipientName) || str(pulse.reachTreeName) || 'your Lifetree');
  const lead = isGroup ? `${fromName} sent a message to ${toName} (a group you're in):` : `${fromName} sent a direct message to ${toName}:`;
  const subject = isGroup ? `${fromName} messaged ${toName} on ${nodeName}` : `${fromName} sent ${toName} a direct message on ${nodeName}`;
  const words = dressMailText(`${lead}\n\n"${message}"`, voice);
  const origin = escapeHtml(voice.origin);
  const html = `<div style="font-family: sans-serif; line-height: 1.6; color: ${voice.ink}; background: ${voice.paper}; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">`
    + `<h2 style="color: ${voice.primary}; font-weight: 300; letter-spacing: 1px; margin-bottom: 6px;">${escapeHtml(voice.name)}</h2>`
    + `<p style="font-size: 13px; color: #9ca3af; margin: 0 0 24px;">A new ${isGroup ? 'group message' : 'direct message'} for <strong style="color:${voice.primary};">${escapeHtml(toName)}</strong></p>`
    + (voice.greeting ? `<p style="font-size: 15px; margin: 0 0 10px;">${escapeHtml(voice.greeting).replace(/\n/g, '<br>')}</p>` : '')
    + `<p style="font-size: 15px; margin: 0 0 10px; color:#6b7280;">${escapeHtml(lead)}</p>`
    + `<blockquote style="font-size: 16px; margin: 0 0 28px; padding: 16px 20px; background:rgba(0,0,0,0.04); border-left: 4px solid ${voice.primary}; border-radius: 8px;">${escapeHtml(message).replace(/\n/g, '<br>')}</blockquote>`
    + (voice.signature ? `<p style="font-size: 15px; margin: 0 0 20px;">${escapeHtml(voice.signature).replace(/\n/g, '<br>')}</p>` : '')
    + `<a href="${origin}" style="display:inline-block; background:${voice.primary}; color:#fff; text-decoration:none; font-weight:bold; padding:10px 22px; border-radius:9999px; font-size:14px;">Open your messages</a>`
    + `<hr style="border: 0; border-top: 1px solid #eee; margin: 24px 0;" />`
    + `<p style="font-size: 12px; color: #9ca3af;">You receive this because direct-message email notifications are on in your <a href="${origin}" style="color: ${voice.primary}; text-decoration: none;">${escapeHtml(voice.name)} profile</a>. You can turn this off anytime.<br/>${escapeHtml(voice.footer)}</p>`
    + `</div>`;
  return { subject, html, text: `${words}\n\nOpen your messages: ${voice.origin}` };
};

// ── THE KEEPER'S KNOCK: someone asked to join a place ─────────────────────────────────────────
export const knockLetterOf = (f: { requester: string; communityName: string; nodeName: string; nodeOrigin: string }, voice: MailVoice): ReachLetter => {
  const requester = f.requester || 'Someone';
  const communityName = f.communityName || 'your community';
  const text = `${requester} asked to join ${communityName}.\n\nYou can accept or decline on the community's Members tab.`;
  const letter = systemLetterOf(text, f.nodeOrigin, `Open ${f.nodeName}`, voice);
  return { subject: `${requester} asked to join ${communityName}`, html: letter.html, text: `${dressMailText(text, voice)}\n\n${f.nodeOrigin}` };
};
// The keepers a knock reaches: the anchor and the delegated stewards, never the requester, bounded.
export const knockRecipientsOf = (f: { anchorUid: unknown; stewardUids: readonly unknown[]; requesterUid: string }): string[] =>
  [...new Set([f.anchorUid, ...f.stewardUids].filter((uid): uid is string => typeof uid === 'string' && !!uid && uid !== f.requesterUid))].slice(0, MAIL_KNOCK_RECIPIENTS);

// ── THE WELCOME: the first letter an account receives ─────────────────────────────────────────
export const welcomeLetterOf = (f: { displayName: string; nodeName: string }): { subject: string; text: string } => ({
  subject: `Welcome to ${f.nodeName}`,
  text: `Welcome to ${f.nodeName}${f.displayName ? ', ' + f.displayName : ''}. You have planted your intention. Now you may plant your tree.`,
});

// ── THE LETTER OF A PLACE: its footer, one per subscriber (functions letters.ts) ──────────────
export const newsletterFooterOf = (f: { placeName: string; unsubscribeUrl: string }, voice: MailVoice): string =>
  `<hr style="border:0;border-top:1px solid #eee;margin:28px 0;"/>`
  + `<p style="font-size:12px;color:#9ca3af;line-height:1.6;">You're receiving this because you subscribed to the letter of ${escapeHtml(f.placeName)}.<br/>`
  + `<a href="${escapeHtml(f.unsubscribeUrl)}" style="color:${voice.primary};">Unsubscribe</a> · ${escapeHtml(voice.footer)}</p>`;
export const unsubscribeUrlOf = (nodeOrigin: string, token: string): string => `${nodeOrigin.replace(/\/+$/, '')}/u/${encodeURIComponent(token)}`;
export const newsletterHeadersOf = (unsubscribeUrl: string): Record<string, string> =>
  ({ 'List-Unsubscribe': `<${unsubscribeUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' });

// ── DELIVERY: the courier's patience ──────────────────────────────────────────────────────────
export type MailState = 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'ERROR';
export const mailRetryDelayMs = (attempts: number): number =>
  Math.min(MAIL_RETRY_MAX_MS, MAIL_RETRY_BASE_MS * 2 ** Math.max(0, attempts - 1));
// After an attempt: success rests; a failure waits longer each time, and gives up after the last try.
export const mailSettlementOf = (f: { attempts: number; ok: boolean; error?: string | null }): { state: MailState; nextInMs: number | null; error: string | null } => {
  if (f.ok) return { state: 'SUCCESS', nextInMs: null, error: null };
  const error = (f.error ?? 'delivery_failed').slice(0, 500);
  if (f.attempts >= MAIL_MAX_ATTEMPTS) return { state: 'ERROR', nextInMs: null, error };
  return { state: 'PENDING', nextInMs: mailRetryDelayMs(f.attempts), error };
};
// An outbox effect (a reach, a knock, a welcome) too old to be meaningful is retired, never sent late.
export const outboxIsStale = (createdAtMs: number, nowMs: number): boolean => nowMs - createdAtMs > OUTBOX_STALE_MS;
