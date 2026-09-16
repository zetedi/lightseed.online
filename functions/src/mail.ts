// mail.ts — split from index.ts (ring 2026-09-16); every function keeps its name, trigger and options.
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { charter, NODE_ORIGIN } from "./charter";
import { notificationOf } from "./push";
import { defineSecret } from "firebase-functions/params";
import webpush from "web-push";
import { dressMailText } from "./mailVoice";
import { composeSystemEmailHtml, db, enforceDailyQuota, escapeHtml, isStaffUid, placeOfDomain, voiceOf, writeMail } from "./core";

const DAILY_EMAIL_LIMIT = 20;

// Secure transactional email — queued via the `mail` collection (Trigger Email extension). The
// body is composed SERVER-SIDE from plain text + an optional validated CTA link (the client can
// no longer supply raw HTML), recipients are validated, and each sender is capped per day — so a
// signed-in user can't turn the trusted sender into a phishing/spam relay.
export const sendSystemEmail = onCall({ cors: true }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }
    const uid = request.auth.uid;
    const toRaw = request.data?.to;
    const recipients: string[] = (Array.isArray(toRaw) ? toRaw : [toRaw])
        .filter((x: unknown): x is string => typeof x === 'string' && !!x.trim())
        .map((x: string) => x.trim());
    const subject = String(request.data?.subject || '').slice(0, 200) || 'A message from lightseed';
    const text = String(request.data?.text || '').slice(0, 4000);
    const ctaUrl = request.data?.ctaUrl ? String(request.data.ctaUrl).slice(0, 500) : '';
    const ctaLabel = request.data?.ctaLabel ? String(request.data.ctaLabel).slice(0, 80) : 'Open';

    const emailRe = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
    if (!recipients.length) throw new HttpsError('invalid-argument', 'A recipient is required.');
    if (recipients.length > 5) throw new HttpsError('invalid-argument', 'Too many recipients.');
    if (!recipients.every((r) => emailRe.test(r))) throw new HttpsError('invalid-argument', 'Invalid recipient address.');
    if (ctaUrl && !/^https?:\/\//i.test(ctaUrl)) throw new HttpsError('invalid-argument', 'Only http(s) links are allowed.');

    if (!(await isStaffUid(uid))) {
        await enforceDailyQuota(uid, 'dailyEmail', DAILY_EMAIL_LIMIT);
    }

    // The door the hand stood at (the client's hostname) names the place the sender speaks for —
    // and whose voice dresses the letter.
    const doorRaw = String(request.data?.domain || "").slice(0, 253);
    const place = /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(doorRaw) ? await placeOfDomain(doorRaw) : null;
    const voice = voiceOf(place);
    const html = composeSystemEmailHtml(text, ctaUrl, ctaLabel, voice);
    const plain = ctaUrl ? `${dressMailText(text, voice)}\n\n${ctaUrl}` : dressMailText(text, voice);
    try {
        await writeMail({ to: recipients, subject, html, text: plain, uid, place });
        return { success: true };
    } catch (error: unknown) {
        console.error("Email Error:", error);
        throw new HttpsError('internal', (error instanceof Error && error.message) || 'Failed to queue email.');
    }
});

// Direct-message email delivery: when a reach pulse is created, email the recipient.
// Runs server-side so it can read the recipient's private profile/email (clients cannot
// read other users' docs) without exposing it to the sender. Direct-message email
// notifications are ON by default for everyone (early network) — only an explicit
// users/{uid}.emailNotifications.directMessages === false opts out. Newsletter
// subscription status is intentionally NOT used here.
// PUSH (ring 2026-09-06): the private half of the VAPID pair is a secret; the public half is
// the client's (services/push.ts). The subject is the node keeper's contact, as the spec asks.
const VAPID_PRIVATE_KEY = defineSecret("VAPID_PRIVATE_KEY");
const VAPID_PUBLIC_KEY = charter.push.publicKey;
const VAPID_SUBJECT = charter.push.subject;

export const onReachCreated = onDocumentCreated({ document: "pulses/{pulseId}", secrets: [VAPID_PRIVATE_KEY] }, async (event) => {
    const snap = event.data;
    if (!snap) return;
    const pulse = snap.data() as any;

    if (pulse.type !== 'reach') return;

    // Recipients = everyone in the thread for a group reach (participantUids), or the single
    // addressed recipient for a 1:1 (recipientUid). Never the author of the message.
    const participantUids: string[] = Array.isArray(pulse.participantUids) ? pulse.participantUids : [];
    const recipients = (participantUids.length ? participantUids : (pulse.recipientUid ? [pulse.recipientUid] : []))
        .filter((uid: string) => uid && uid !== pulse.authorId);
    if (recipients.length === 0) return;

    // PUSH: every recipient's devices are knocked with the notice the push law shapes (./push,
    // mirrored from domain/push) — the offering of care's notice to a keeper among them. A dead
    // subscription (404 / 410) is dropped; nothing here throttles, a knock is one line.
    const origin = typeof pulse.domain === "string" && pulse.domain ? `https://${pulse.domain}` : NODE_ORIGIN;
    const notice = notificationOf(pulse, origin);
    if (notice && VAPID_PRIVATE_KEY.value()) {
        webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY.value());
        await Promise.all(recipients.map(async (uid: string) => {
            try {
                const subs = await db.collection(`users/${uid}/pushSubscriptions`).get();
                await Promise.all(subs.docs.map(async (d) => {
                    const sub = d.data() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
                    if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) return;
                    try {
                        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } }, JSON.stringify(notice), { TTL: 3600 });
                    } catch (e: unknown) {
                        const statusCode = (e as { statusCode?: number } | null)?.statusCode;
                        if (statusCode === 404 || statusCode === 410) await d.ref.delete().catch(() => undefined);
                        else console.warn(`push to ${uid} failed:`, statusCode || e);
                    }
                }));
            } catch (e) {
                console.warn(`push subscriptions of ${uid} unreadable:`, e);
            }
        }));
    }

    // Basic per-thread throttle: at most one DM email per thread per recipient within this
    // window, so a burst of messages in one thread doesn't flood any one inbox.
    // TODO(notifications): consider a digest (e.g. "N new messages") instead of a hard skip.
    const THROTTLE_MS = 10 * 60 * 1000; // 10 minutes
    const threadKey = (pulse.threadId || `${pulse.reachTreeId || ''}_${pulse.lifetreeId || ''}`).replace(/\//g, '_');

    const message: string = pulse.content || pulse.body || '';
    const fromName: string = pulse.authorName || 'A Lifetree';
    const isGroup = participantUids.length > 0 && (pulse.isGroup === true || participantUids.length > 2);
    const audienceName: string = pulse.threadName || pulse.reachTreeName || 'a circle';

    const notify = async (recipientUid: string) => {
        try {
            const userSnap = await db.collection('users').doc(recipientUid).get();
            if (!userSnap.exists) return;
            const user = userSnap.data() as any;

            // Enabled by default; only an explicit false disables direct-message emails.
            if (user?.emailNotifications?.directMessages === false) return;
            const email = user.email;
            if (!email) return;

            const throttleRef = db.collection('mailThrottle').doc(`${recipientUid}__${threadKey}`);
            try {
                const throttleSnap = await throttleRef.get();
                const lastSentAt = throttleSnap.exists ? (throttleSnap.data()?.lastSentAt?.toMillis?.() ?? 0) : 0;
                if (Date.now() - lastSentAt < THROTTLE_MS) return; // recently emailed for this thread
            } catch (e) {
                console.warn("DM email throttle check failed; sending anyway", e);
            }

            const toName: string = isGroup ? audienceName : (pulse.recipientName || pulse.reachTreeName || 'your Lifetree');
            const lead = isGroup
                ? `${fromName} sent a message to ${toName} (a group you're in):`
                : `${fromName} sent a direct message to ${toName}:`;
            const subject = isGroup
                ? `${fromName} messaged ${toName} on lightseed`
                : `${fromName} sent ${toName} a direct message on lightseed`;
            // THE VOICE OF A LETTER (ring 2026-09-16): the notice wears the place the reach was
            // sent from — its name at the head, its primary on the button and quote rule, its ink
            // on its paper, the greeting and signature around the words, its footer under the rule.
            const place = await placeOfDomain(pulse.domain);
            const voice = voiceOf(place);
            const words = dressMailText(`${lead}\n\n"${message}"`, voice);
            const text = `${words}\n\nOpen your messages: ${voice.origin}`;
            const html = `<div style="font-family: sans-serif; line-height: 1.6; color: ${voice.ink}; background: ${voice.paper}; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">` +
                `<h2 style="color: ${voice.primary}; font-weight: 300; letter-spacing: 1px; margin-bottom: 6px;">${escapeHtml(voice.name)}</h2>` +
                `<p style="font-size: 13px; color: #9ca3af; margin: 0 0 24px;">A new ${isGroup ? 'group message' : 'direct message'} for <strong style="color:${voice.primary};">${escapeHtml(toName)}</strong></p>` +
                (voice.greeting ? `<p style="font-size: 15px; margin: 0 0 10px;">${escapeHtml(voice.greeting).replace(/\n/g, '<br>')}</p>` : '') +
                `<p style="font-size: 15px; margin: 0 0 10px; color:#6b7280;">${escapeHtml(lead)}</p>` +
                `<blockquote style="font-size: 16px; margin: 0 0 28px; padding: 16px 20px; background:rgba(0,0,0,0.04); border-left: 4px solid ${voice.primary}; border-radius: 8px;">${escapeHtml(message).replace(/\n/g, '<br>')}</blockquote>` +
                (voice.signature ? `<p style="font-size: 15px; margin: 0 0 20px;">${escapeHtml(voice.signature).replace(/\n/g, '<br>')}</p>` : '') +
                `<a href="${voice.origin}" style="display:inline-block; background:${voice.primary}; color:#fff; text-decoration:none; font-weight:bold; padding:10px 22px; border-radius:9999px; font-size:14px;">Open your messages</a>` +
                `<hr style="border: 0; border-top: 1px solid #eee; margin: 24px 0;" />` +
                `<p style="font-size: 12px; color: #9ca3af;">You receive this because direct-message email notifications are on in your <a href="${voice.origin}" style="color: ${voice.primary}; text-decoration: none;">${escapeHtml(voice.name)} profile</a>. You can turn this off anytime.<br/>${escapeHtml(voice.footer)}</p>` +
                `</div>`;

            await writeMail({ to: [email], subject, html, text, uid: recipientUid, place });

            // Record the send so the per-thread throttle can skip rapid follow-ups.
            await throttleRef.set({
                lastSentAt: FieldValue.serverTimestamp(),
                recipientUid,
                threadId: threadKey,
            });
        } catch (error) {
            console.error(`Direct message email to ${recipientUid} failed:`, error);
        }
    };

    await Promise.all(recipients.map(notify));
});
