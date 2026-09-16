// lifetrees.ts — split from index.ts (ring 2026-09-16); every function keeps its name, trigger and options.
import { onDocumentCreated, onDocumentUpdated, onDocumentWritten } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { FieldValue } from "firebase-admin/firestore";
import { createHash } from "node:crypto";
import { db, isStaffUid, mintLid } from "./core";

// --- Planting caps, enforced server-side -------------------------------------------------
// The client gate (domain/limits + plantLifetree) is advisory — a direct Firestore write
// bypasses it. This trigger is the backstop: when a tree lands over the node's caps
// (config/limits, defaults 193 lifetrees + 132 guarded per being; 193 = the UN roll,
// one citizenship-tree per country), the newest over-cap tree
// is uprooted. Quality, not quantity — enforced where it can't be dodged. Staff and the
// system are exempt, mirroring every other quota.
//
// Beds have their own ceilings: exempt from the 193/132 forest caps (furniture is not
// forest), but a HOUSED bed is bounded per Light House — else the open lightHouses create
// plus the bed exemption would reopen an unbounded, cap-exempt write channel into
// `lifetrees` — and a LOOSE bed (no house to bound it) is bounded per keeper.
const MAX_BEDS_PER_LIGHT_HOUSE = 64;
const MAX_LOOSE_BEDS_PER_KEEPER = 32;

// Shared bed-counting, consulted at birth (onLifetreeCreated) and on every home-move
// (onBedHomeMoved). Each count INCLUDES the bed just written, so `> MAX` means the
// ceiling is already breached.
const countBedsInHouse = async (houseId: string): Promise<number> => {
    const beds = await db.collection("lifetrees")
        .where("treeType", "==", "BED")
        .where("lightHouseId", "==", houseId)
        .get();
    return beds.size;
};

// LOOSE beds: the field may be absent or '', so count the keeper's beds and keep only
// the houseless ones.
const countLooseBedsOfKeeper = async (ownerId: string): Promise<number> => {
    const mine = await db.collection("lifetrees")
        .where("treeType", "==", "BED")
        .where("ownerId", "==", ownerId)
        .get();
    return mine.docs.filter((d) => !d.data().lightHouseId).length;
};

export const onLifetreeCreated = onDocumentCreated("lifetrees/{treeId}", async (event) => {
    const snap = event.data;
    if (!snap) return;
    const tree = snap.data() as any;
    const ownerId = tree.ownerId as string;
    if (!ownerId || ownerId === "GENESIS_SYSTEM") return;
    try {
        if (await isStaffUid(ownerId)) return;

        const isBedTree = (t: any) => t.treeType === "BED";

        // Beds (treeType BED, domain/bed.ts) are furniture, not the keeper's personal forest:
        // exempt from the 193/132 caps below, but bounded by their own ceilings. A HOUSED bed
        // counts against its Light House — otherwise anyone could mint a Light House and pour
        // unlimited cap-exempt beds into `lifetrees`. A LOOSE bed (no house — standing at a
        // coordinate under open stars) has no house to bound it, so it counts against its
        // keeper instead. Over either ceiling, the just-created bed is uprooted, mirroring
        // the forest-cap uproot below. (Mass Light-House creation itself remains a broader,
        // pre-existing vector — out of scope here; see root/QUESTIONS.md.)
        if (isBedTree(tree)) {
            const houseId = String(tree.lightHouseId ?? "");
            if (houseId === "") {
                const loose = await countLooseBedsOfKeeper(ownerId);
                if (loose > MAX_LOOSE_BEDS_PER_KEEPER) {
                    await snap.ref.delete();
                    console.warn(`Loose-bed cap enforced: uprooted ${snap.id} (keeper ${ownerId}, ${loose} loose beds vs ${MAX_LOOSE_BEDS_PER_KEEPER}).`);
                }
                return;
            }
            const housed = await countBedsInHouse(houseId);
            if (housed > MAX_BEDS_PER_LIGHT_HOUSE) {
                await snap.ref.delete();
                console.warn(`Bed cap enforced: uprooted ${snap.id} (lightHouse ${houseId}, ${housed} beds vs ${MAX_BEDS_PER_LIGHT_HOUSE}).`);
            }
            return;
        }

        const [limitsSnap, mine] = await Promise.all([
            db.collection("config").doc("limits").get(),
            db.collection("lifetrees").where("ownerId", "==", ownerId).get(),
        ]);
        const num = (v: any, fallback: number) => {
            const n = Number(v);
            return Number.isFinite(n) && n >= 1 ? Math.floor(n) : fallback;
        };
        const raw = limitsSnap.exists ? limitsSnap.data() : {};
        const maxLifetrees = num(raw?.maxLifetrees, 193);
        const maxGuardedTrees = num(raw?.maxGuardedTrees, 132);

        const isGuardedTree = (t: any) => t.treeType === "GUARDED" || (!t.treeType && t.isNature === true);
        const trees = mine.docs.map((d) => d.data()).filter((t) => !isBedTree(t));
        const guarded = trees.filter(isGuardedTree).length;
        const lifetrees = trees.length - guarded;
        const over = isGuardedTree(tree) ? guarded > maxGuardedTrees : lifetrees > maxLifetrees;
        if (!over) return;

        await snap.ref.delete();
        console.warn(`Planting cap enforced: uprooted ${snap.id} (owner ${ownerId}, ${lifetrees} lifetrees / ${guarded} guarded vs ${maxLifetrees}/${maxGuardedTrees}).`);
    } catch (e) {
        console.error(`Planting cap check failed for ${snap.id}:`, e);
    }
});

// A bed's home is SOFT — `lightHouseId` may change after birth (loose ↔ housed, house to
// house), so the create-time ceilings above would be paper walls if the edit path could
// walk around them: plant 64 housed beds, edit them all loose, plant 64 more... Every
// HOME-MOVE therefore re-consults the DESTINATION's ceiling. A breaching move is REVERTED
// — the home returns to its prior value — never deleted: an established bed may already
// carry stays and leaves; only the newborn is uprooted (create path above).
//
// Loop-safety: we act only when the home actually changed, and only the DESTINATION is
// consulted — the source held this bed a moment ago, so returning there is within cap in
// the common case, and the revert's own echo-trigger finds its destination within cap and
// rests. If BOTH homes breach (caps crossed by concurrent moves), the bed is left LOOSE
// with a log line rather than ping-ponged between two full houses: loose is the absorbing
// state, so every path converges after at most one revert write.
export const onBedHomeMoved = onDocumentUpdated("lifetrees/{treeId}", async (event) => {
    const before = event.data?.before.data() as any;
    const after = event.data?.after.data() as any;
    if (!before || !after || after.treeType !== "BED") return;
    const beforeHouse = String(before.lightHouseId ?? "");
    const afterHouse = String(after.lightHouseId ?? "");
    if (beforeHouse === afterHouse) return; // no home-move — nothing to guard

    const ownerId = String(after.ownerId ?? "");
    if (!ownerId || ownerId === "GENESIS_SYSTEM") return;
    try {
        if (await isStaffUid(ownerId)) return; // staff stay exempt, mirroring every quota

        // Is the DESTINATION over its ceiling, with this bed now counted inside it?
        const overCap = afterHouse === ""
            ? (await countLooseBedsOfKeeper(ownerId)) > MAX_LOOSE_BEDS_PER_KEEPER
            : (await countBedsInHouse(afterHouse)) > MAX_BEDS_PER_LIGHT_HOUSE;
        if (!overCap) return;

        // Would returning breach the source house too? (+1: the bed would re-enter that count.)
        const sourceWouldBreach = beforeHouse !== ""
            && (await countBedsInHouse(beforeHouse)) + 1 > MAX_BEDS_PER_LIGHT_HOUSE;

        if (afterHouse === "" && sourceWouldBreach) {
            // Both homes breach and the bed already stands loose: leave it under open
            // stars and say so — a write would only ping-pong between two full homes.
            console.warn(`Bed cap: both homes of ${event.params.treeId} breach; left loose (keeper ${ownerId}).`);
            return;
        }
        const revertTo = sourceWouldBreach ? "" : beforeHouse;
        await event.data!.after.ref.update({ lightHouseId: revertTo });
        console.warn(`Bed cap enforced on home-move: ${event.params.treeId} sent home to ${revertTo === "" ? "the open stars (loose)" : revertTo} — destination ${afterHouse === "" ? "loose" : afterHouse} is over its ceiling (keeper ${ownerId}).`);
    } catch (e) {
        console.error(`Bed home-move cap check failed for ${event.params.treeId}:`, e);
    }
});

// --- Beds: availability + the leaves of who stayed -------------------------------------------
// A stay is a request to sleep in a specific BED (domain/stay.ts). Two server duties keep a bed's
// calendar honest and its story permanent.
const stayRangesOverlap = (a: { fromDate: string; toDate: string }, b: { fromDate: string; toDate: string }): boolean =>
    a.fromDate < b.toDate && b.fromDate < a.toDate; // half-open [from, to) — the departure day is free

// When a keeper ACCEPTS a stay: refuse a double-booking (a bed holds one guest at a time), then
// publish the identity-free occupancy so any guest sees busy/free nights. When a stay LEAVES
// 'accepted' (declined or withdrawn/deleted), withdraw that occupancy. Reverting a conflicting
// accept to 'declined' re-fires this trigger (accepted→declined), which finds no occupancy to
// remove and rests — convergent. (In the rare case a keeper accepts two overlapping requests in
// the very same instant, both may be declined; that is safe — a bed is never double-booked — and
// the keeper simply re-accepts one.)
// The event's snapshot says only that SOMETHING changed; Firebase does not order events, so a
// withdrawal handled before a delayed acceptance would have re-published occupancy for a stay
// that no longer stands (Lumo's review, 2026-09-07). So the handler RECONCILES: it reads the
// stay as it is NOW and the occupancy as it is NOW, in one transaction, and makes the second
// match the first — accepted ⇒ occupancy stands (refusing a double-booking), anything else
// (declined, withdrawn, deleted) ⇒ occupancy is gone. Convergent whatever the order.
export const onStayWritten = onDocumentWritten("stays/{stayId}", async (event) => {
    const before = event.data?.before?.data() as Record<string, unknown> | undefined;
    const after = event.data?.after?.data() as Record<string, unknown> | undefined;
    const stayId = event.params.stayId;
    const bedId = String(after?.bedId || before?.bedId || "");
    if (!bedId) return;
    try {
        await db.runTransaction(async (t) => {
            const stayRef = db.doc(`stays/${stayId}`);
            const occRef = db.doc(`lifetrees/${bedId}/occupancy/${stayId}`);
            const [staySnap, occSnap] = await Promise.all([t.get(stayRef), t.get(occRef)]);
            const stay = staySnap.exists ? (staySnap.data() as Record<string, unknown>) : null;
            if (stay?.status !== "accepted") {
                if (occSnap.exists) t.delete(occRef);
                return;
            }
            if (occSnap.exists) return; // already published for this very stay
            const range = { fromDate: String(stay.fromDate || ""), toDate: String(stay.toDate || "") };
            const others = await t.get(db.collection("stays").where("bedId", "==", bedId).where("status", "==", "accepted"));
            const conflict = others.docs.some(d =>
                d.id !== stayId && stayRangesOverlap(d.data() as { fromDate: string; toDate: string }, range));
            if (conflict) {
                t.update(stayRef, { status: "declined" });
                console.warn(`Bed double-booking refused: stay ${stayId} on bed ${bedId} overlaps an accepted stay — declined.`);
                return;
            }
            t.set(occRef, range);
        });
    } catch (e) {
        console.error(`onStayWritten failed for ${stayId}:`, e);
    }
});

// The legacy block hash — sha256(JSON.stringify(pulseData) + previousHash + mintedAt) — the exact
// scheme mintPulse (src/services/firebase/pulses.ts) uses for an UNSEALED chain. A bed is not a
// node, so its chain is unsealed; the same UTF-8 preimage yields the same digest in Node, so a bed
// stays verifiable under src/domain/chain (linkage + height; legacy blocks aren't re-hashed).
const legacyBlockHash = (pulseData: object, previousHash: string, mintedAt: number): string =>
    createHash("sha256").update(JSON.stringify(pulseData) + previousHash + mintedAt).digest("hex");

// Seal ONE completed stay as a leaf on its bed's chain — atomically and idempotently: the mint,
// the bed's new head, and the stay's `leafed` flag ride a single transaction, so a leaf is never
// minted twice and concurrent mints cannot fork the chain (previousHash is always the freshly-read
// head). Mirrors mintPulse: the hashed `pulseData` is the immutable content; the stored doc adds id
// / lid / mintedAt / previousHash / createdAt / hash around it.
const mintStayLeaf = async (stayId: string): Promise<void> => {
    const stayRef = db.doc(`stays/${stayId}`);
    await db.runTransaction(async (t) => {
        const staySnap = await t.get(stayRef);
        const s = staySnap.data() as Record<string, any> | undefined;
        if (!staySnap.exists || !s || s.leafed || s.status !== "accepted") return;
        const bedRef = db.doc(`lifetrees/${s.bedId}`);
        const bedSnap = await t.get(bedRef);
        if (!bedSnap.exists) return;
        const bed = bedSnap.data() as Record<string, any>;
        const prevHash = String(bed.latestHash || bed.genesisHash || "0");
        const mintedAt = Date.now();
        const pulseData: Record<string, unknown> = {
            lifetreeId: s.bedId,
            type: "stay",
            visibility: "node",
            // The leaf wears the guest's chosen tree face only — never their human display name.
            // A guest who picked no tree stays anonymous ("A guest"); the node-visible chain must
            // not become an identity-linked whereabouts record for a real (loose-bed) coordinate.
            title: s.guestTreeName || "A guest",
            body: `stayed ${s.fromDate} → ${s.toDate}`,
            authorId: s.uid,
            authorName: s.guestTreeName || "",
            ...(s.guestTreeGrowthUrl ? { imageUrl: s.guestTreeGrowthUrl } : {}),
        };
        const hash = legacyBlockHash(pulseData, prevHash, mintedAt);
        const pulseRef = db.collection("pulses").doc();
        t.set(pulseRef, {
            ...pulseData,
            lid: mintLid(),
            id: pulseRef.id,
            loveCount: 0,
            commentCount: 0,
            mintedAt,
            previousHash: prevHash,
            stayId,
            createdAt: FieldValue.serverTimestamp(),
            hash,
        });
        t.update(bedRef, { latestHash: hash, blockHeight: (bed.blockHeight || 0) + 1 });
        t.update(stayRef, { leafed: true });
    });
};

// Daily: every accepted stay whose departure has passed and that isn't yet leafed becomes a
// permanent leaf on its bed's chain — the record of who stayed.
export const mintStayLeaves = onSchedule("every day 03:00", async () => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const snap = await db.collection("stays").where("status", "==", "accepted").get();
    for (const d of snap.docs) {
        const s = d.data() as Record<string, any>;
        if (s.leafed || !(String(s.toDate || "") < today)) continue;
        try {
            await mintStayLeaf(d.id);
        } catch (e) {
            console.error(`mintStayLeaf failed for stay ${d.id}:`, e);
        }
    }
});
