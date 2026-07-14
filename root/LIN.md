# LIN — what world we are creating

The seed: purpose, ontology, principles, language, invariants.
The evolving interpretation of the promise in `GENESIS.md`.

## Ontology — Indra's net

**Everything is a Being.** Every jewel is different, and every jewel reflects all
the others the same way. A Being has four aspects (`src/domain/being.ts`):

| Aspect | What | Where |
|---|---|---|
| **True name** | `lid` — UUIDv7, birth-time in its first bits, portable across nodes and years | every stored doc |
| **Story** | its chain — hash-linked pulses, append-only, unerasable | `pulses`, `domain/chain.ts` |
| **Circle** | its links — relations as entities, never arrays | `links` collection (the LIN) |
| **Face** | its profile — the shared anatomy of sections | `components/sections/` |

Humans, AIs, communities, nodes, trees, sanctuaries, visions, events, pulses —
all Beings. Any intelligence can log in. Composite beings (communities, nodes)
additionally grow a **Council** — the organ by which many become one voice.

## Principles

1. **Quality, not quantity.** A node caps at 144 lifetrees (12 personal + 132
   guarded). Growth happens by division, like Pando — one root system, many stems.
2. **Links, not arrays.** A relationship is itself an entity in the `links`
   collection with deterministic ids (`from__rel__to`). The only arrays permitted
   are rules-ACL denormalisations (e.g. `participantUids` on private reaches).
3. **The chain is append-only.** Nothing on a chain is ever rewritten or deleted;
   wrong things are *marked* (the guardian veto), never erased.
4. **Private by default.** Opening something to the world is a deliberate act.
   The visibility ladder: community → node → public.
5. **Data, not code.** Organisations get landings, themes, pages as *data* —
   never per-org source files.
6. **Paper outlives databases.** Every being carries a QR with its lid
   (`/b/<lid>`), the offline/online bridge.
7. **Sanctuaries root in trees, never before them.** A sanctuary is never built
   before a tree is planted; the tree that holds one becomes a **mother tree**.
8. **The care economy pays people, not platforms.** €21/yr protects one tree:
   15 to the carer, 3 to the community, 3 to the node (spent on intelligence).
   Whoever is a member before payments launch keeps today's functions free.
9. **Power is visible.** A staff-only capability wears the amber dot (SuperDot).
   Carrying a being's voice always names the carrier.
10. **The internet has no weather, only moods.** Physical reality is first-class:
    real coordinates, real EXIF moments, real fires at real sanctuaries.

## Language

*tend* (care as action) · *mint* (seal a moment onto a chain) · *water* (the
photo-proofed care pulse) · *keeper* (a community's owner) · *guardian* (a
no-privilege follow that vows protection) · *validated = initiated* (standing
in the web of trust) · *sanctuary* (a sacred place; a lighthouse on the map) ·
*mother tree* (a tree holding a sanctuary) · *the Light Path* (the onboarding
trail — ultimately each community's own ruleset) · *reach* (one being speaking
to another) · *carry* (lending hands to a being's voice, always disclosed) ·
*consecrate* (create a sanctuary) · *release* (delete one) · *step in* (a
sanctuary sheltering a community) · *the Moment* (see GENESIS.md).

## Invariants — never silently contradict these

- `GENESIS_MOMENT_MS = 1566149243000` and its place — golden (`domain/genesis.ts`).
- Chain fields (`hash`, `previousHash`, `genesisHash`, `blockHeight`, `authorId`,
  `createdAt` of chain docs) are frozen after creation — in rules and in spirit.
- `lid` is never recycled, never renamed, never derived from a database id.
- The 144 cap is enforced server-side (`functions/onLifetreeCreated`) — the client
  gate is courtesy, the function is law.
- Guardian veto = consensus of ALL eligible guardians (author excluded), within
  72 hours, marking — not deleting.
- The quality gate (`npm run check`) stays green. Rules changes ship with
  `npm run test:rules` green.
