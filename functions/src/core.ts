// THE COMMON GROUND of the server (ring 2026-09-16): the admin app, the database handle, the
// mail plumbing and the staff/quota gates every module leans on. Imports nothing from the
// feature modules — so no cycle can leave a helper undefined at init.
import { HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { randomBytes } from "node:crypto";
import { uuidv7 } from "./mint";
import { charter, NODE_ORIGIN, mailFromOf, charterOwnDomains } from "./charter";
import { mailVoiceOf, dressMailText, type MailVoice, type MailVoiceSource } from "./mailVoice";
import { initializeApp } from "firebase-admin/app";

initializeApp();

// Every lid a server function mints is a UUIDv7 (the LIN invariant: a Being's true name is
// time-ordered and portable). node:crypto supplies the randomness; mint.ts the pure algorithm.
export const mintLid = () => uuidv7(Date.now(), randomBytes(10));


export const db = getFirestore();

// --- Email via the Firestore `mail` collection (Firebase Trigger Email extension) -------------
// All outbound email stays in-house: writing a doc to `mail` queues it through the installed
// firestore-send-email extension (Nodemailer under the hood). THE DOCUMENT'S SHAPE (ring
// 2026-09-07): the extension reads `from`, `replyTo` and `headers` from the TOP LEVEL of the
// mail document (mailOptions.from = payload.from || DEFAULT_FROM) and only subject / text /
// html / attachments from `message`. For months these rode inside `message`, so every mail
// fell back to the extension's bare default sender — recipients saw "admin@lightseed.online"
// with no name — and the newsletter's List-Unsubscribe headers never left the queue.

// The PLACE a mail is triggered at — the community rooted at a domain, or answering at one of
// its doors (the getCommunityByDomain fallback) — so the sender may wear its name
// (charter mailFromOf: "The Living Web - The O House"). A node domain, or no cradle, is the node.
// THE VOICE OF A LETTER (ring 2026-09-14): the place also lends its body — name at the head,
// palette on the button and paper, a greeting, a signature, a footer line — all read from the
// community's own record by the mirrored law (mailVoice); the node speaks bare.
type MailPlace = ({ name?: string | null; domain?: string | null } & { source?: MailVoiceSource | null }) | null;
// Physical postal address for every footer (CAN-SPAM). TODO: replace with the real
// registered address before sending at volume.
const NEWSLETTER_POSTAL_ADDRESS = "The O House, Bigeh Island, Aswan, Egypt";
const NODE_VOICE = { name: charter.name, origin: NODE_ORIGIN, postal: NEWSLETTER_POSTAL_ADDRESS };
export const voiceOf = (place: MailPlace): MailVoice => mailVoiceOf(place?.source ?? (place ? { name: place.name, domain: place.domain } : null), NODE_VOICE);
export const placeOfCommunity = (c: Record<string, unknown>, domain?: string): MailPlace => ({
    name: String(c.name || ""),
    domain: String(c.domain || domain || ""),
    source: { name: c.name as string, domain: (c.domain as string) || domain, theme: c.theme as MailVoiceSource["theme"], mail: c.mail as MailVoiceSource["mail"] },
});
export const placeOfDomain = async (domainRaw: unknown): Promise<MailPlace> => {
    const domain = String(domainRaw || "").trim().toLowerCase().replace(/^www\./, "");
    if (!domain || charterOwnDomains(charter).includes(domain)) return null;
    try {
        let cradle = await db.collection("communities").where("domain", "==", domain).limit(1).get();
        if (cradle.empty) cradle = await db.collection("communities").where("domainAliases", "array-contains", domain).limit(1).get();
        if (cradle.empty) return { domain };
        return placeOfCommunity(cradle.docs[0].data() as Record<string, unknown>, domain);
    } catch { return { domain }; }
};

export const writeMail = async (params: { to: string | string[]; subject: string; html: string; text?: string; headers?: Record<string, string>; uid?: string; place?: MailPlace }) => {
    // Firestore rejects any document containing `undefined` (the extension doc write would fail
    // with "Cannot use undefined as a Firestore value"), so optional fields are only set when present.
    const message: { subject: string; html: string; text?: string } = { subject: params.subject, html: params.html || "" };
    if (params.text) message.text = params.text;
    const mail: Record<string, unknown> = {
        to: Array.isArray(params.to) ? params.to : [params.to],
        uid: params.uid || null,
        from: mailFromOf(charter, params.place),
        message,
        createdAt: FieldValue.serverTimestamp(),
    };
    if (params.headers) mail.headers = params.headers;
    await db.collection("mail").add(mail);
};

// The branded system-email shell, composed SERVER-SIDE so a client can never inject arbitrary
// HTML (previously the client passed a full `html` string — an open phishing relay). Text is
// HTML-escaped; the CTA is only rendered for an already-validated http(s) URL.
export const escapeHtml = (s: string): string =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Dressed in the place's VOICE (ring 2026-09-14): its name where ".seed" stood, its primary on
// the button and links, its ink on its paper, the greeting and signature around the words,
// its footer line under the rule. The node's own letters wear the shell voice unchanged.
export const composeSystemEmailHtml = (text: string, ctaUrl: string, ctaLabel: string, voice: MailVoice = voiceOf(null)): string => {
    const body = escapeHtml(dressMailText(text, voice)).replace(/\n/g, "<br>");
    const cta = ctaUrl
        ? `<div style="margin:24px 0;"><a href="${ctaUrl}" style="display:inline-block;background:${voice.primary};color:#fff;text-decoration:none;font-weight:bold;padding:12px 26px;border-radius:9999px;font-size:15px;">${escapeHtml(ctaLabel)}</a></div><p style="font-size:12px;color:#9ca3af;">Or paste this link:<br/><a href="${ctaUrl}" style="color:${voice.primary};word-break:break-all;">${escapeHtml(ctaUrl)}</a></p>`
        : "";
    return `<div style="font-family: sans-serif; line-height: 1.6; color: ${voice.ink}; background: ${voice.paper}; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;"><h2 style="color: ${voice.primary}; font-weight: 300; letter-spacing: 1px; margin-bottom: 20px;">${escapeHtml(voice.name)}</h2><div style="font-size: 16px; margin-bottom: 8px;">${body}</div>${cta}<hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" /><p style="font-size: 12px; color: #9ca3af; text-align: center;">Sent from <a href="${voice.origin}" style="color: ${voice.primary}; text-decoration: none;">${escapeHtml(voice.name)}</a> on the Lifetree Network<br/>${escapeHtml(voice.footer)}</p></div>`;
};

// --- Staff check + server-authoritative daily quotas -----------------------------------------
export const isStaffUid = async (uid: string): Promise<boolean> => {
    const [superadmin, adminDoc] = await Promise.all([
        db.collection("config").doc("superadmin").get(),
        db.collection("admins").doc(uid).get(),
    ]);
    return adminDoc.exists || (superadmin.exists && superadmin.data()?.uid === uid);
};

export const enforceDailyQuota = async (uid: string, field: string, limit: number): Promise<void> => {
    const ref = db.collection("usage").doc(uid);
    const day = new Date().toISOString().slice(0, 10); // UTC yyyy-mm-dd
    await db.runTransaction(async (t) => {
        const data = ((await t.get(ref)).data() || {}) as Record<string, unknown>;
        const sameDay = data.day === day;
        const current = sameDay ? Number(data[field] || 0) : 0;
        if (current >= limit) {
            throw new HttpsError("resource-exhausted", `Daily limit reached (${limit}). It resets at midnight UTC.`);
        }
        if (sameDay) t.set(ref, { [field]: current + 1 }, { merge: true });
        else t.set(ref, { day, [field]: 1 }); // new day: overwrite, clearing yesterday's counters
    });
};

export const keeperLinkRef = (uid: string, communityId: string) =>
    db.collection("links").doc(`${uid}__keeper__${communityId}`);

export const normalizeAnchorDomain = (value: string): string => {
    const withoutScheme = value.trim().toLowerCase().replace(/^https?:\/\//, "");
    const authority = withoutScheme.split(/[/?#]/, 1)[0] || "";
    return authority.replace(/^www\./, "").replace(/:\d+$/, "");
};

export const tsToMs = (t: unknown): number =>
    t && typeof (t as { toMillis?: unknown }).toMillis === "function" ? (t as { toMillis: () => number }).toMillis()
        : (t instanceof Date ? t.getTime() : (typeof t === "number" ? t : 0));

// The bucket the face previews and image variants live in (preview.ts, pictures.ts) — read at
// module init by a trigger option, so it lives on the common ground.
export const FACE_BUCKET = charter.firebase.bucket;
