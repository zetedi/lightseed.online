// lidIndex.ts — split from index.ts (ring 2026-09-16); every function keeps its name, trigger and options.
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { entryFor, COLLECTION_FOR_KIND } from "./beingIndex";
import { db, isStaffUid } from "./core";

// --- THE LID INDEX ------------------------------------------------------------------------
// beings/{lid} -> { kind, collection, docId }: a true name written down beside the local
// address holding it today (root ring 2026-08-09; the law lives in src/domain/beingIndex.ts,
// mirrored here by ./beingIndex). Until now a lid was not ADDRESSED but SEARCHED FOR —
// findBeingByLid asks collection after collection until one answers.
//
// Written ONLY here, never by a client (firestore.rules refuses every client write to
// /beings), because an identity record a client could forge is not an identity record: anyone
// could claim a lid or re-point someone else's name.
//
// create(), never set(): a lid already written is NEVER re-pointed by a trigger. That is the
// frozen half of the law enforced by construction rather than by care. A legitimate move — an
// import, a restore, a migration — is a deliberate, trusted act and belongs to the backfill,
// which reports a disagreement instead of overwriting it.
//
// The index owns nothing. Every being still stands, still carries its lid, and still resolves
// by the old search if this collection is emptied.
const recordBeing = async (collection: string, docId: string, raw: unknown): Promise<void> => {
    const lid = (raw as { lid?: unknown } | undefined)?.lid;
    const entry = entryFor(collection, docId, lid);
    if (!entry) return; // no true name, or a collection the index does not address
    try {
        await db.collection("beings").doc(entry.lid).create({
            ...entry,
            recordedAt: FieldValue.serverTimestamp(),
        });
    } catch (e: unknown) {
        if ((e as { code?: number })?.code !== 6) {
            console.warn(`lid index: could not record ${collection}/${docId}`, e);
            return;
        }
        // 6 = ALREADY_EXISTS. Almost always the law working: triggers fire at least once, so a
        // re-run finds its own entry and must stay quiet. But the same refusal would hide a real
        // fault — one lid on two beings — so look once before swallowing it.
        const already = (await db.collection("beings").doc(entry.lid).get()).data();
        if (already && (already.collection !== entry.collection || already.docId !== entry.docId)) {
            console.error(
                `lid index: ONE TRUE NAME, TWO BEINGS — ${entry.lid} is written at `
                + `${already.collection}/${already.docId} and was just born at ${collection}/${docId}. `
                + `The index keeps the first; a human must decide.`,
            );
        }
    }
};

const onBeingBorn = (collection: string) =>
    onDocumentCreated(`${collection}/{docId}`, async (event) => {
        if (!event.data) return;
        await recordBeing(collection, event.params.docId, event.data.data());
    });

// One per addressed kind. Relations (links, alignments, covenants) carry lids too and are
// deliberately NOT indexed: they name bonds BETWEEN beings and are found through the beings
// they bind, so indexing them would map the whole graph to no one's benefit.
export const indexPersonLid = onBeingBorn("users");
export const indexTreeLid = onBeingBorn("lifetrees");
export const indexVisionLid = onBeingBorn("visions");
export const indexLightHouseLid = onBeingBorn("lightHouses");
export const indexCommunityLid = onBeingBorn("communities");
export const indexPulseLid = onBeingBorn("pulses");

// The backfill: every being born BEFORE the triggers above existed still has a true name and no
// entry. Staff-run, idempotent, safe to re-run. It writes ONLY missing entries — where an entry
// already exists and disagrees, it REPORTS and moves on, because re-pointing a lid is a
// deliberate, governed act (a move, an import) and never a sweep's side effect. It also names
// the fault the index's shape cannot catch on its own: two different lids claiming one address.
export const backfillLidIndex = onCall({ cors: true }, async (request) => {
    const uid = request.auth?.uid;
    if (!uid || !(await isStaffUid(uid))) throw new HttpsError("permission-denied", "Staff only.");
    const apply = request.data?.apply === true;

    // The whole index once, into memory — NOT a read per being. A sweep that asks Firestore
    // for every lid one at a time is a sweep that times out on the first busy collection.
    const held = new Map<string, { kind?: string; collection?: string; docId?: string }>();
    (await db.collection("beings").get()).forEach((d) => held.set(d.id, d.data() as never));

    const missing: { entry: ReturnType<typeof entryFor>; address: string }[] = [];
    const disagreements: { lid: string; existing: string; found: string }[] = [];
    const claimed = new Map<string, string>(); // address -> first lid seen
    const collisions: { address: string; lids: string[] }[] = [];
    let nameless = 0;

    for (const collection of Object.values(COLLECTION_FOR_KIND)) {
        // select('lid'): the sweep needs a document's true name and nothing else. Pulling whole
        // pulse documents into memory to read one field is how a one-off migration runs out of it.
        const snap = await db.collection(collection).select("lid").get();
        for (const doc of snap.docs) {
            const entry = entryFor(collection, doc.id, doc.data()?.lid);
            if (!entry) { nameless++; continue; }

            const address = `${entry.collection}/${entry.docId}`;
            const firstLid = claimed.get(address);
            if (firstLid && firstLid !== entry.lid) collisions.push({ address, lids: [firstLid, entry.lid] });
            else claimed.set(address, entry.lid);

            const already = held.get(entry.lid);
            if (already) {
                if (already.collection !== entry.collection || already.docId !== entry.docId || already.kind !== entry.kind) {
                    disagreements.push({
                        lid: entry.lid,
                        existing: `${already.kind}:${already.collection}/${already.docId}`,
                        found: `${entry.kind}:${address}`,
                    });
                }
                continue;
            }
            missing.push({ entry, address });
        }
    }

    // Batched, 400 at a time (Firestore's limit is 500) — one round trip per batch, not per being.
    if (apply) {
        for (let i = 0; i < missing.length; i += 400) {
            const batch = db.batch();
            for (const { entry } of missing.slice(i, i + 400)) {
                batch.set(db.collection("beings").doc(entry!.lid), {
                    ...entry,
                    recordedAt: FieldValue.serverTimestamp(),
                });
            }
            await batch.commit();
        }
    }
    const written = missing.map((m) => `${m.entry!.kind}:${m.address}`);

    const report = { apply, wrote: written.length, nameless, disagreements, collisions };
    console.log("lid index backfill:", JSON.stringify(report));
    return report;
});
