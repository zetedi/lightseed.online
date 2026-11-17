# Proposal: a vision stands on its own, and may be grounded in a tree

**Status:** decided 2026-11-17; steps 1 and 2 (origin) are built and the root documents carry
the ring. This file remains only as the reasoning behind it and the list of what is left (section 6).
**Raised by:** Zoltán ("separate the visions from the trees and have the option to ground a
vision in a tree, so gardeners and visionaries can meet there").
**Written by:** Aspen (Claude). **Decides:** Zoltán.

This file holds the reasoning, the plain contract, the exact text proposed for each root
document, the decisions that are Zoltán's, and the order of building. When a decision is taken,
the ring goes into `root/DECISIONS.md` and this file can be deleted.

---

## 0. What changed while building (2026-11-17)

The ring in `root/DECISIONS.md` is the record. In short, against the text below: the knock is
made by the server (`askGround`), not written by the client; nothing private takes ground (so
private twins cannot be migrated into `links`); a vision's `authorId` is frozen; both blocks are
authored by the acting hand; light needs ground whose care is current.

## 1. What is true today (read from the code, 2026-11-17)

| Fact | Where |
|---|---|
| The root calls a vision "the idea-twin of a tree", born the same moment, keeping its tree as a shadow (`lifetreeId`). | `root/LIN.md` (Language), ring 2026-07-17 |
| A LIFETREE's Root Vision is born automatically at planting. A guarded (nature) tree, a bed and a secret tree get none. | `src/services/firebase/trees.ts:279-287` |
| A Root Vision is recognised by its **title**: `vision.title.toLowerCase() === 'root vision'`. Its protection from deletion hangs on that string. | `src/components/VisionProfile.tsx:65-71` |
| A later vision is grounded by a **field**, and the form offers only the author's **own** trees. | `src/components/modals/CreateVisionModal.tsx:45-46, 86` |
| The rules let any signed-in being create a vision. No Firestore rule reads a vision's `lifetreeId`. A being with no tree already sends `lifetreeId: ''`. | `firestore.rules:980-990` |
| A tree's keeper can enlist the tree in a vision with a `participant` link (tree → vision). It is one-sided (the vision's author is not asked) and grants nothing. | `firestore.rules:1830`, `src/components/TreeParticipants.tsx` |
| An offering can be made to a tree or a vision and is accepted on its leaf, minted on both chains. | `root/LIN.md` (*offer to*), `firestore.rules:1273-1298` |
| The field is read by: the vision's face (rooted-in card, shadow compare), resonance (to find the tree behind a vision), the community crossing, the data model, and the independent node's schema. | `VisionProfile.tsx`, `useResonance.ts:76-90`, `domain/communityCrossing.ts:95-99`, `domain/dataModel.ts`, `seed/schema/*` |

Three things follow:

1. **A visionary and a gardener cannot meet through grounding today.** A vision can only name its
   author's own tree. The one cross-person tie (`participant`) runs the other way and asks no one.
2. **Treeless visions already exist in the law, unnamed.** The rules permit them; the root does not
   speak of them. This is a place where the code and the root have drifted.
3. **"Root Vision" is a title, not a relation.** The metaphor is hiding a weaker model: rename the
   vision and it stops being the root.

## 2. The proposal in one paragraph

A vision is a being in its own right: authored by a being, growing its own chain of
contributions, needing no tree to exist. **Grounding** is a relation, not a field: the vision's
author asks a tree, one of the tree's carers says yes, and the yes is written once on both
chains and stands as a link `vision__grounded_in__tree`. One vision may be grounded in several
trees; one tree may ground several visions. A vision with no ground says so on its face
("seeking ground"). The twin born at planting remains possible, as a vision whose first ground
is its birth tree, and it is recognised by that link, never by its title.

## 3. The plain contract

**Guaranteed (once built):**

- A vision exists and grows its chain with or without a tree.
- A `grounded_in` link exists only when **both** the vision's author and a carer of the tree
  (keeper or steward) consented. No client hand can write it; the server mints it.
- Each grounding, and each letting go, is one sealed block on the vision's chain and one on the
  tree's chain. Chains are append-only: an ended grounding is marked, never erased.
- A secret tree and a bed never ground a vision.
- A tree never grounds a vision more visible than itself (links are world-readable, so a ground
  on a private tree would otherwise betray it).
- A Root Vision is known by its birth ground (`birth: true` on the link), not by its title.
- Either side can end a grounding alone: the author for the vision, any carer for the tree.

**Not guaranteed:**

- That the vision is being realised on that land. Grounding records consent, not work.
- That the two beings are distinct people. An author grounding a vision in their own tree is one
  being saying yes twice; it is allowed and marked as self-grounding.
- Any privilege. A `grounded_in` link grants no read, write or keeping right on either side.
- Any standing in the light economy. Whether a ground changes what a vision may receive is an
  open decision (D3 below) and until decided nothing changes.

**Enforced by (to be written):** `src/domain/grounding.ts` (pure law: who may ask, who may accept,
which trees may ground which visions, the caps) with tests; a server function for accept and
release; link rules refusing client-made `grounded_in`; the same law on the independent node;
`tests/rules` cases for each refusal.

## 4. Proposed text for the root documents

### 4.1 `root/LIN.md`, Language: replace the *vision* entry

Current:

> *vision* (a being, the **idea-twin of a tree**: when a tree is planted its Root Vision is born the
> *same moment*; matter and idea, they diverge, each growing its own chain: the tree's of tending,
> the vision's of **contributions**. A vision keeps its tree as a **shadow** (`lifetreeId`), so the two
> growths can be laid side by side and compared)

Proposed:

> *vision* (a being: an idea a being voices, growing its own chain of **contributions**. It needs
> no tree to exist. A vision with no ground is **seeking ground** and says so on its face) ·
> *ground* (the relation where idea meets matter: a vision's author asks a tree, a carer of the
> tree says yes, and the yes is sealed once on both chains: `vision__grounded_in__tree`. One
> vision may stand in several trees, one tree may ground several visions. It records consent, it
> grants nothing. A secret tree and a bed ground no one. Where a ground stands, the two chains can
> be laid side by side and compared) · *Root Vision* (the vision born the same moment as a tree,
> when its planter chooses to voice one: its first ground is its birth tree, and it is known by
> that birth ground, never by its title)

### 4.2 `root/LIN.md`, Principles: one sentence added to "Links, not arrays"

> A field that names another being is an array of one: where two beings must both consent, the
> relation is a link.

### 4.3 `root/DECISIONS.md`: the ring (to be added only when decided)

> ### 2026-11-__ — A vision stands on its own; ground is where it meets a tree
>
> The 2026-07-17 ring made tree and vision twins and gave the vision its own chain. That ring
> chose separation over collapse ("that separation is what grants freedom"). This ring completes
> it. The twin was still tied by a field (`vision.lifetreeId`) that could only name the author's
> own tree, so a visionary without land and a gardener without words had no place to meet, and a
> Root Vision was recognised by its title. Now a vision needs no tree. Grounding is a link
> (`vision__grounded_in__tree`) minted by the server after the vision's author asks and a carer of
> the tree accepts, sealed once on each chain; either side may end it, and the ending is marked.
> Many to many. A secret tree and a bed ground no one; a tree grounds nothing more visible than
> itself. The twin at planting is the planter's choice, and a Root Vision is known by its birth
> ground. Guaranteed: consent of both sides, both chains bear it, no privilege follows. Not
> guaranteed: that the vision is realised on that land, or that author and carer are different
> people. `lifetreeId` on visions is retired after the migration writes one birth ground for every
> existing value; until then it is read as a legacy shadow. Corrects, does not rewrite, the
> 2026-07-17 ring. Zoltán's words: "so gardeners and visionaries can meet there."

### 4.4 `root/QUESTIONS.md`: a new section

> ## The ground between idea and matter (2026-11-17)
>
> Raised by Zoltán when the vision was freed from its tree.
>
> - Is a ground a relation, or does it become a being once it has a history (the covenant walked
>   that road: a relation that grew its own chain)? When two people tend one ground for years,
>   where does that story live: on the two chains, or on its own?
> - A vision has an author and nothing else. Should a vision gather keepers as a tree does, so
>   that a dream can outlive the one who first voiced it?
> - What does an ungrounded vision deserve? Voice, surely. Light, care, offerings? Is a dream that
>   never touches soil lesser, or only earlier?
> - A tree's keeper can already enlist the tree in a vision (`participant`), unasked. Is that a
>   lighter gesture that should remain ("this tree stands with that dream"), or was it always a
>   ground waiting for the other side's yes?
> - If a lifetree is itself a relation (see "The lifetree as relation"), is a ground a relation
>   between an idea and a relation?

### 4.5 `root/ARCHITECTURE.md`: a paragraph where visions are described, and one debt

> **Visions and their ground.** A vision is a top-level being (`visions`), authored (`authorId`),
> with its own chain. Its tie to matter is the LIN: `vision__grounded_in__tree`, server-minted on
> acceptance of a `ground_request` knock, law in `domain/grounding.ts`. The Root Vision of a tree
> is the vision whose ground carries `birth: true`.
>
> *Debt while migrating:* `vision.lifetreeId` still exists on stored documents and in the
> independent node's schema; readers prefer the link and fall back to the field until the
> migration ring retires it.

### 4.6 `root/ROADMAP.md`: one entry in the current section

> - **Grounded visions.** (1) the law and its tests; (2) ask, accept, release on both backends;
>   (3) faces: "seeking ground", a tree's visions, a vision's grounds; (4) migration of every
>   `lifetreeId` to a birth ground, authorised before it runs; (5) the field retired.

`root/GENESIS.md` is untouched. `root/INTERBEING_MATRIX.md` gains a row only if the ring is taken.

## 5. Decisions that are Zoltán's

**Decided 2026-11-17:** Zoltán agreed with every recommendation below (D1 to D7), and changed D3:
**only a grounded vision receives light** ("that makes the system regenerative"). The law reads it
as: light may reach a vision only while it stands in at least one *living* tree
(`visionReceivesLight`, `src/domain/grounding.ts`). What "a vision receives light" means in the
economy (today rays are held by people, and move at an offering's appreciation) is still to be
defined at step 2, where the gate must bite.

**Step 1 (the law) is written:** `src/domain/grounding.ts`, `tests/grounding.test.ts`, the two rels
in `domain/link.ts` and `domain/subgraph.ts`, thirteen refusal words in en/ar/zh. Nothing enforces
it yet.

Each has my recommendation first.

- **D1. Who may voice an ungrounded vision?**
  *Recommended:* any signed-in being, as the rules already allow. The secret tree set the
  precedent ("belonging before rooting"). Alternative: only a being who keeps or guards a tree.
- **D2. The twin at planting.**
  *Recommended:* the planter chooses; planting a tree no longer creates a vision unless they voice
  one. Existing Root Visions stay and gain their birth ground. Alternative: keep the automatic
  twin, only re-expressed as a link.
- **D3. What an ungrounded vision may not do.**
  *Recommended:* it is listed under "seeking ground" and is not shown in public landing sections,
  and nothing else is withheld. I have **not** traced what a vision can receive in the light
  economy (offerings, love, resonance), so I do not recommend withholding any of it yet.
- **D4. Which trees may ground.**
  *Recommended:* lifetrees and guarded (nature) trees, by a keeper's or steward's yes; never a
  secret tree, never a bed. A guarded tree is exactly where a community's gardeners and a
  visionary would meet. Alternative: lifetrees only.
- **D5. Caps.**
  *Recommended:* at most 12 grounds per vision and 12 visions per tree (quality, not quantity;
  the same number as faces and secret trees). Alternative: no cap until one is needed.
- **D6. The `participant` link on visions.**
  *Recommended:* leave it untouched in this ring (events use the same rel) and keep the question
  open in QUESTIONS. Alternative: turn every tree→vision `participant` into a ground request.
- **D7. Self-grounding.**
  *Recommended:* allowed, sealed like any other, marked `self: true` so a face can tell a meeting
  from a monologue.

## 6. Order of building (each step its own reviewed batch)

1. **Law.** `src/domain/grounding.ts` + tests: `mayAskGround`, `mayAcceptGround`, `mayGround(tree,
   vision)` (kind, visibility, caps), `rootVisionOf(links)`. `grounded_in` and `ground_request`
   added to the walk's map (`REL_ENDPOINTS`, `SKIP_RELS`).
2. **Hands.** A server function for accept and release (mints the link and the two blocks in one
   transaction); link rules: the author may create and withdraw `ground_request`, no client may
   write `grounded_in`; rules tests. The independent node's twin of the same law.
3. **Faces.** Vision: its grounds, "seeking ground", ask a tree. Tree: its visions, the asks
   waiting for its carers. The create-vision form stops requiring a tree. Shadow compare picks
   among grounds (birth ground first).
4. **Migration, additive.** For every vision with a `lifetreeId` that names a living tree: one
   `grounded_in` link, `birth: true` where the title is "Root Vision" and the tree is the author's.
   No chain block is back-dated; the migration writes one dated "ground recorded" block on each
   chain, or none (a decision to take at that ring). Dry-run report first, run only on your word.
5. **Retire the field.** Readers lose the fallback; crossing, bundle, data model and the seed
   schema follow; `lifetreeId` leaves the `Vision` type.

Steps 1 to 3 change nothing for existing data. Step 4 is the consequential one.

## 7. Risks and what I have not checked

- **Cheap talk.** Without a tree, a vision costs nothing to voice. D3 and D5 are the only brakes
  proposed. If the feed fills with ungrounded dreams, the brake is too weak.
- **Privacy.** Links are world-readable. The visibility rule in section 3 must be enforced by the
  server at acceptance **and** re-checked when a tree or vision changes visibility; I have not
  designed the second half.
- **Two backends.** The independent node carries `lifetree_id` on visions through at least a dozen
  migrations (`seed/schema/011, 038-061`). I have listed them, not read them.
- **Resonance** uses the field to find "the tree behind a vision" so a conversation can start.
  With many grounds, or none, it needs a different answer (reach the author). Not designed.
- **Community crossing** takes a vision along when its tree crosses (`communityCrossing.ts:95`).
  With grounds in several communities the rule needs restating. Not designed.
- **Not verified:** how many stored visions have an empty or dangling `lifetreeId`; whether any
  Root Vision has been renamed (and so already lost its protection); what offerings to an
  ungrounded vision would mean for the care economy.
