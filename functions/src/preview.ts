// preview.ts — split from index.ts (ring 2026-09-16); every function keeps its name, trigger and options.
import { onRequest } from "firebase-functions/v2/https";
import { faceFeedOf, feedDomainOf } from "./faceEvents";
import { charter, charterHosts } from "./charter";
import { FACE_PREVIEW_MAX_BYTES, facePreviewAttempts, facePreviewDoorOf, facePreviewKeyOf, facePreviewUrlOf, sharePlaceNameOf, shareTitleOf } from "./facePreview";
import { getStorage } from "firebase-admin/storage";
import sharp from "sharp";
import { FACE_BUCKET, db, placeOfDomain, tsToMs } from "./core";

// ---------------------------------------------------------------------------
// The living world, visible — per-being link previews + the living sitemap.
//
// /b/<lid> is served by `beingPreview` (a hosting rewrite ahead of the ** catch-
// all): EVERYONE receives the same 200 page — the deployed index.html with its
// head meta swapped to the being's own name, words and image. Bots read the
// meta; a human's SPA boots and lidFromPath opens the being. No user-agent
// sniffing. PUBLIC beings only: anything node/community/private (or unknown)
// serves the UNMODIFIED shell — the generic card, never a leaked name. Every
// interpolated field is HTML-escaped: a being's name/body is user content
// entering raw HTML.
// ---------------------------------------------------------------------------

// Node 22 ships global fetch; the functions tsconfig lib (es2022) has no type for it.
// The slice of fetch these functions use (lib is es2022, no DOM): the shell as text for the
// /b/ card, a being's photo as bytes — bounded by a signal — for the face preview.
declare const fetch: (
    url: string,
    init?: { headers?: Record<string, string>; signal?: AbortSignal; redirect?: "follow" | "error" | "manual" },
) => Promise<{
    ok: boolean;
    headers: { get(name: string): string | null };
    text(): Promise<string>;
    arrayBuffer(): Promise<ArrayBuffer>;
}>;

// Mirrors src/domain/beingLink.ts lidFromPath — the lid a /b/ path names.
// Both door shapes (mirror of src/domain/beingLink + lid62): the canonical dashed lid AND
// the 22-char base62 compact form every printed QR now carries. The first version matched
// hex only, so a compact share link fell through to the generic face card.
const LID_RE = /^\/b\/([0-9a-zA-Z-]{8,})\/?$/;
const LID62_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const lidFromDoor = (raw: string): string | null => {
    if (raw.length === 22) {
        let n = 0n;
        for (const ch of raw) {
            const v = LID62_ALPHABET.indexOf(ch);
            if (v < 0) return null;
            n = n * 62n + BigInt(v);
        }
        if (n >= (1n << 128n)) return null;
        const hex = n.toString(16).padStart(32, "0");
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
    return /^[0-9a-fA-F-]{8,}$/.test(raw) ? raw : null;
};

// Attribute-safe escape for user content entering raw HTML. (The email
// escapeHtml above leaves ' alone; meta content deserves all five.)
const escapeHtmlFull = (s: string): string => s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const collapseWhitespace = (s: string): string => s.replace(/\s+/g, " ").trim();
const truncate160 = (s: string): string => (s.length <= 160 ? s : `${s.slice(0, 159).trimEnd()}…`);

// The host the visitor actually asked for (hosting forwards it in x-forwarded-host),
// pattern-gated so a forged header can never inject into a fetch URL or the canonical.
const requestHost = (req: { hostname?: string; headers: Record<string, unknown> }): string => {
    const fwd = String(req.headers["x-forwarded-host"] || "").split(",")[0].trim();
    const host = fwd || String(req.hostname || "");
    return /^[a-z0-9][a-z0-9.-]*$/i.test(host) ? host : charter.domain;
};

// THE MIRROR GUARD (the 22M-invocation lesson, 2026-07-27). These functions are also reachable
// on their raw *.run.app address, where `requestHost` returns the function's OWN host. Fetching
// the shell from that host called the function again, whose fallback redirect called it again:
// a self-sustaining loop that one bot knock kept alive for a week. So every public HTTP surface
// resolves the request to a CANONICAL host it actually serves; anything else (run.app included)
// collapses to the primary domain. The shell fetch also announces itself and is answered with an
// empty 204 if it ever reaches this function again, so recursion is impossible twice over.
// Every host a face of this node answers at — the charter's, never a list by heart.
const CANONICAL_HOSTS = new Set(charterHosts(charter));
const SHELL_FETCH_UA = "lightseed-shell-fetch";
const canonicalHost = (req: { hostname?: string; headers: Record<string, unknown> }): string => {
    const host = requestHost(req).toLowerCase().replace(/^www\./, "");
    return CANONICAL_HOSTS.has(host) ? host : charter.domain;
};

interface PublicBeingCard {
    name: string;
    body: string;
    image?: string;
    // The ground the being stands on (its `domain` stamp) — names the PLACE on the card.
    domain?: string;
    // Present only for a public Light House — becomes a JSON-LD Place block.
    place?: { latitude?: number; longitude?: number };
}

// Server-side mirror of findBeingByLid (src/services/firebase/beings.ts), PUBLIC-ONLY:
// the admin SDK sees everything, so the visibility gate lives here, per collection.
// A lid names exactly one being — once a collection matches, its gate decides alone.
const findPublicBeingByLid = async (lid: string): Promise<PublicBeingCard | null> => {
    const one = async (coll: string) =>
        (await db.collection(coll).where("lid", "==", lid).limit(1).get()).docs[0];

    const treeDoc = await one("lifetrees");
    if (treeDoc) {
        const t = treeDoc.data() as Record<string, unknown>;
        // Absent visibility = public (legacy trees) — but a BED's absent default is
        // 'node' (domain/bed.ts), so only an explicit 'public' opens a bed.
        const isPublic = t.visibility === "public" || (t.visibility == null && t.treeType !== "BED");
        if (!isPublic) return null;
        return {
            name: String(t.name || ""),
            body: String(t.body || ""),
            image: (t.latestGrowthUrl || t.imageUrl || undefined) as string | undefined,
            domain: String(t.domain || ""),
        };
    }

    const houseDoc = await one("lightHouses");
    if (houseDoc) {
        const h = houseDoc.data() as Record<string, unknown>;
        if (h.visibility !== "public") return null; // absent = 'community' — NOT public
        return {
            name: String(h.name || ""),
            body: String(h.body || ""),
            image: (h.imageUrl || undefined) as string | undefined,
            domain: String(h.domain || ""),
            place: {
                latitude: typeof h.latitude === "number" ? h.latitude : undefined,
                longitude: typeof h.longitude === "number" ? h.longitude : undefined,
            },
        };
    }

    const visionDoc = await one("visions");
    if (visionDoc) {
        const v = visionDoc.data() as Record<string, unknown>;
        if (!(v.visibility === "public" || v.visibility == null)) return null;
        return {
            name: String(v.title || ""),
            body: String(v.body || ""),
            image: (v.imageUrl || undefined) as string | undefined,
            domain: String(v.domain || ""),
        };
    }

    // Pulses — events, offerings, minted growths (the first version knew only the three
    // above, so a public event's share link fell to the generic card). PUBLIC only; the
    // absent-visibility legacy default is public (domain/pulseVisibility), and a private
    // reach always carries its explicit level, so it can never leak here.
    const pulseDoc = await one("pulses");
    if (pulseDoc) {
        const pu = pulseDoc.data() as Record<string, unknown>;
        if (!(pu.visibility === "public" || pu.visibility == null)) return null;
        return {
            name: String(pu.title || ""),
            body: String(pu.body || pu.content || ""),
            image: (((pu.imageUrls as string[] | undefined) || [])[0] || pu.imageUrl || undefined) as string | undefined,
            domain: String(pu.domain || ""),
        };
    }

    return null;
};

// Replace the text between two captured delimiters with an already-escaped value.
// A replacer FUNCTION, never a replacement string: user content may contain `$&`
// and friends, which String.replace would expand.
const setBetween = (html: string, re: RegExp, value: string): string =>
    html.replace(re, (_m, pre: string, post: string) => `${pre}${value}${post}`);

// Swap the deployed shell's head meta for one being. All values arrive RAW and are
// escaped here, once, at the boundary.
const swapHeadMeta = (
    shell: string,
    raw: { title: string; siteName?: string; description: string; image: string; url: string; card?: "summary" },
    placeLd?: object,
): string => {
    const title = escapeHtmlFull(raw.title);
    const siteName = raw.siteName ? escapeHtmlFull(raw.siteName) : null;
    const description = escapeHtmlFull(raw.description);
    const image = escapeHtmlFull(raw.image);
    const url = escapeHtmlFull(raw.url);

    let out = shell;
    out = setBetween(out, /(<title>)[\s\S]*?(<\/title>)/, title);
    out = setBetween(out, /(<meta name="description" content=")[^"]*(")/, description);
    out = setBetween(out, /(<link rel="canonical" href=")[^"]*(")/, url);
    for (const [prop, value] of [
        ["og:title", title], ["og:description", description],
        ["og:url", url], ["og:image", image], ["og:image:alt", title],
        ...(siteName ? ([["og:site_name", siteName]] as const) : []),
    ] as const) {
        out = setBetween(out, new RegExp(`(<meta property="${prop}" content=")[^"]*(")`), value);
    }
    for (const [name, value] of [
        ["twitter:title", title], ["twitter:description", description], ["twitter:image", image],
        // A being's share rides the SMALL card (a compact square thumb beside the words),
        // not the face's full-width banner — pass card: 'summary' to shrink it.
        ...(raw.card ? ([["twitter:card", raw.card]] as const) : []),
    ] as const) {
        out = setBetween(out, new RegExp(`(<meta name="${name}" content=")[^"]*(")`), value);
    }
    // The static og:image dimensions/type describe og.png; for a being's own image
    // they would lie, so they are dropped.
    if (!raw.image.endsWith("/og.png")) {
        out = out.replace(/\n?\s*<meta property="og:image:(?:type|width|height)" content="[^"]*" \/>/g, "");
    }
    if (placeLd) {
        // <-escape < so user content can never break out via </script>. The replacement is a
        // FUNCTION for the same reason as setBetween: `$&`/`$'`/"$`" in user content would
        // otherwise be expanded by String.replace and splice document text into the script.
        const json = JSON.stringify(placeLd).replace(/</g, "\\u003c");
        out = out.replace("</head>", () => `<script type="application/ld+json">${json}</script>\n</head>`);
    }
    return out;
};

export const beingPreview = onRequest(async (req, res) => {
    // Belt and braces: if our own shell fetch ever lands here again, answer nothing at all.
    if (String(req.headers["user-agent"] || "") === SHELL_FETCH_UA) { res.status(204).end(); return; }
    // The deployed shell, fetched from the CDN at a CANONICAL host only. Through Hosting the
    // static /index.html is served before rewrites; on the raw run.app address the old
    // `requestHost` pointed the fetch back at this very function (the mirror guard above).
    const host = canonicalHost(req);
    let shell = "";
    try {
        const r = await fetch(`https://${host}/index.html`, { headers: { "user-agent": SHELL_FETCH_UA } });
        if (r.ok) shell = await r.text();
    } catch (e) {
        console.error("beingPreview: shell fetch failed:", e);
    }
    // No shell to dress: hand the visitor to the canonical CDN, never to "/" on the
    // current host (on run.app that relative redirect re-invoked this function).
    if (!shell) { res.redirect(302, `https://${host}/`); return; }

    res.set("Content-Type", "text/html; charset=utf-8");
    res.set("Cache-Control", "public, max-age=300, s-maxage=600");
    try {
        const rawDoor = ((req.path || "").match(LID_RE) || [])[1];
        const lid = rawDoor ? lidFromDoor(rawDoor) : null;
        const being = lid ? await findPublicBeingByLid(lid) : null;
        if (!being || !being.name) { res.status(200).send(shell); return; } // generic card

        // THE CARD NAMES ITS PLACE (ring 2026-09-14): the community rooted at the being's
        // domain (name, else bare domain); the node only for its own ground.
        const place = being.domain ? await placeOfDomain(being.domain) : null;
        const placeName = sharePlaceNameOf(place, charter.name);
        const description = truncate160(collapseWhitespace(being.body)) || `${being.name} — a living being on ${placeName}.`;
        // The being's own photo rides as its FACE PREVIEW (/face/<door>.jpg, below): a small,
        // honest JPEG every crawler will fetch, never the stored original (2–28 MB).
        const own = being.image && /^https?:\/\//.test(being.image) ? being.image : null;
        const image = own ? facePreviewUrlOf(host, rawDoor, own) : `https://${host}/og.png`;
        const url = `https://${host}/b/${rawDoor}`;
        const placeLd = being.place ? {
            "@context": "https://schema.org",
            "@type": "Place",
            "name": being.name,
            "description": description,
            "url": url,
            ...(being.place.latitude != null && being.place.longitude != null ? {
                "geo": { "@type": "GeoCoordinates", "latitude": being.place.latitude, "longitude": being.place.longitude },
            } : {}),
        } : undefined;

        res.status(200).send(swapHeadMeta(shell, {
            title: shareTitleOf(being.name, place, charter.name),
            siteName: placeName,
            description,
            image,
            url,
            card: "summary",
        }, placeLd));
    } catch (e) {
        console.error("beingPreview failed:", e);
        res.status(200).send(shell); // never a broken page — the generic shell stands in
    }
});

// --- FACE PREVIEW --------------------------------------------------------------------------
// /face/<door>.jpg — the small, honest picture behind a shared /b/ door. The card above
// points og:image here instead of at the being's stored photo, which can weigh 2–28 MB and
// which the strictest crawlers (WhatsApp, near 300 KB) refuse. The law — the ladder, the
// door, the cache key — lives in domain/facePreview (mirrored in ./facePreview); this
// endpoint owns the plumbing: resolve the being through the same public-only gate the card
// uses, fetch its photo (bounded), walk the ladder with sharp, keep the result in the
// bucket under a key that changes with the source, answer with JPEG bytes. Cached long at
// the CDN: the URL itself carries ?v=<digest>, so a new photo is a new URL, not a stale hit.
const FACE_SOURCE_MAX_BYTES = 40 * 1024 * 1024;
const FACE_FETCH_TIMEOUT_MS = 20_000;
const FACE_GROUND = "#04070f"; // the night the app stands on — under any transparency

// The being's own photo, bounded: a foreign or runaway source never holds the function.
const fetchFaceSource = async (url: string): Promise<Buffer | null> => {
    const r = await fetch(url, { signal: AbortSignal.timeout(FACE_FETCH_TIMEOUT_MS), redirect: "follow" });
    if (!r.ok) return null;
    if (Number(r.headers.get("content-length") || 0) > FACE_SOURCE_MAX_BYTES) return null;
    const bytes = Buffer.from(await r.arrayBuffer());
    return bytes.length > FACE_SOURCE_MAX_BYTES ? null : bytes;
};

// Decode and fit ONCE (upright by EXIF, flattened onto the night, never enlarged), then walk
// the ladder from that small raster: each attempt is a cheap re-encode, not a re-decode of a
// 28 MB original. The first attempt under the budget wins; failing all, the smallest made.
const renderFacePreview = async (source: Buffer): Promise<Buffer> => {
    const [first] = facePreviewAttempts();
    const base = await sharp(source, { failOn: "none", limitInputPixels: 80_000_000 })
        .rotate()
        .flatten({ background: FACE_GROUND })
        .resize({ width: first.edge, height: first.edge, fit: "inside", withoutEnlargement: true })
        .raw()
        .toBuffer({ resolveWithObject: true });
    let best: Buffer | null = null;
    for (const { edge, quality } of facePreviewAttempts()) {
        const out = await sharp(base.data, { raw: { width: base.info.width, height: base.info.height, channels: base.info.channels } })
            .resize({ width: edge, height: edge, fit: "inside", withoutEnlargement: true })
            .jpeg({ quality, mozjpeg: true })
            .toBuffer();
        if (!best || out.length < best.length) best = out;
        if (out.length <= FACE_PREVIEW_MAX_BYTES) return out;
    }
    return best!;
};

export const facePreview = onRequest({ memory: "1GiB", timeoutSeconds: 60 }, async (req, res) => {
    const host = canonicalHost(req);
    // No face to show: the site's own og.png stands in, as it does on the card itself.
    const fallback = () => res.redirect(302, `https://${host}/og.png`);
    try {
        const door = facePreviewDoorOf(req.path || "");
        const lid = door ? lidFromDoor(door) : null;
        const being = lid ? await findPublicBeingByLid(lid) : null;
        const source = being?.image && /^https?:\/\//.test(being.image) ? being.image : null;
        if (!lid || !source) { fallback(); return; }

        const file = getStorage().bucket(FACE_BUCKET).file(facePreviewKeyOf(lid, source));
        const answer = (bytes: Buffer) => {
            res.set("Content-Type", "image/jpeg");
            res.set("Cache-Control", "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800");
            res.status(200).send(bytes);
        };
        const [exists] = await file.exists();
        if (exists) { answer((await file.download())[0]); return; }

        const original = await fetchFaceSource(source);
        if (!original) { fallback(); return; }
        const preview = await renderFacePreview(original);
        await file.save(preview, { contentType: "image/jpeg", resumable: false, metadata: { metadata: { source, lid } } });
        answer(preview);
    } catch (e) {
        console.error("facePreview failed:", e);
        fallback();
    }
});

// --- The living sitemap ------------------------------------------------------
// /sitemap.xml (a hosting rewrite; the static public/sitemap.xml is deleted so it
// can't shadow this). Home + every PUBLIC being as /b/<lid>. Only an explicit
// visibility 'public' is listed — which also keeps beds' non-public defaults and
// every absent-legacy doc out of the index (the preview above still serves those;
// the sitemap is an invitation, not the gate).
export const sitemap = onRequest(async (req, res) => {
    // Canonical host only: a sitemap served on the raw run.app address must still
    // advertise the real domain's URLs, never run.app ones (the mirror guard above).
    const host = canonicalHost(req);
    const xmlOf = (urls: string[]): string =>
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
    const home = `  <url>\n    <loc>https://${host}/</loc>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>`;
    res.set("Content-Type", "application/xml; charset=utf-8");
    res.set("Cache-Control", "public, max-age=3600, s-maxage=21600");
    try {
        const [trees, houses, visions] = await Promise.all([
            db.collection("lifetrees").where("visibility", "==", "public").get(),
            db.collection("lightHouses").where("visibility", "==", "public").get(),
            db.collection("visions").where("visibility", "==", "public").get(),
        ]);
        const beings: { lid: string; ms: number }[] = [];
        for (const snap of [trees, houses, visions]) {
            for (const d of snap.docs) {
                const x = d.data() as any;
                if (typeof x.lid === "string" && x.lid) {
                    beings.push({ lid: x.lid, ms: tsToMs(x.updatedAt) || tsToMs(x.createdAt) });
                }
            }
        }
        beings.sort((a, b) => b.ms - a.ms);
        const MAX_SITEMAP_BEINGS = 500;
        if (beings.length > MAX_SITEMAP_BEINGS) {
            console.warn(`sitemap: ${beings.length} public beings exceed the ${MAX_SITEMAP_BEINGS}-entry cap; newest kept.`);
        }
        const xmlEscape = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const entries = beings.slice(0, MAX_SITEMAP_BEINGS).map((b) => {
            const lastmod = b.ms ? `\n    <lastmod>${new Date(b.ms).toISOString().slice(0, 10)}</lastmod>` : "";
            return `  <url>\n    <loc>https://${host}/b/${xmlEscape(b.lid)}</loc>${lastmod}\n  </url>`;
        });
        res.status(200).send(xmlOf([home, ...entries]));
    } catch (e) {
        console.error("sitemap failed:", e);
        res.status(200).send(xmlOf([home])); // never a broken sitemap — home alone stands
    }
});

// --- FACE EVENTS -------------------------------------------------------------------------
// /faceEvents(?domain=...) — the node speaking a face's happenings to whoever stands at it.
// The hybrid shape gave every mother site a plain <a> INTO the seed; this is the seed's
// voice travelling BACK: a JSON feed of one face's public AND node events, for any domain
// with a cradle (a community rooted by `domain` or answering at a `domainAliases` door).
// A visitor at the face IS at the node — so node-visibility gatherings greet them here —
// while firestore.rules stay strict for raw anonymous queries (the 2026-08-24 tightening).
// The law of what may ride the feed lives in domain/faceEvents (mirrored in ./faceEvents);
// this endpoint owns only the plumbing. Cached like beingPreview so bot knocks stay cheap.
export const faceEvents = onRequest({ cors: true }, async (req, res) => {
    res.set("Cache-Control", "public, max-age=300, s-maxage=600");
    const domain = feedDomainOf(req.query.domain, canonicalHost(req));
    if (!domain) { res.status(400).json({ error: "domain" }); return; }
    try {
        // A face answers by its NAME or at a DOOR — the same fallback as getCommunityByDomain.
        let cradle = await db.collection("communities").where("domain", "==", domain).limit(1).get();
        if (cradle.empty) cradle = await db.collection("communities").where("domainAliases", "array-contains", domain).limit(1).get();
        if (cradle.empty) { res.status(404).json({ error: "no cradle at this domain", events: [] }); return; }
        const home = String(cradle.docs[0].data().domain || domain);
        const pulses = await db.collection("pulses")
            .where("domain", "==", home)
            .where("type", "==", "event")
            .limit(200)
            .get();
        res.status(200).json({ domain: home, events: faceFeedOf(pulses.docs.map((d) => d.data() as Record<string, unknown>)) });
    } catch (e) {
        console.error("faceEvents failed:", e);
        res.status(200).json({ domain, events: [] }); // never a broken feed — silence stands in
    }
});
