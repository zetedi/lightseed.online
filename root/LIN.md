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
   guarded). The cap is intimacy — a circle where every being can be known.
   Growth happens by division (and intimacy), like Pando — one root system,
   many stems, each close enough to touch.
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

## The loop

No layer is supreme in isolation:

```
root ↕ code ↕ experience ↕ living beings and place ↕ reflection ↕ new ring
```

The root expresses the best understanding so far. The code tests it. Experience
refines it. Living beings and places judge it in ways no gate can. Reflection
names what happened. The ring makes it history. Then the root grows clearer.

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

## Invariants — the reasons; these almost never change

- **Life is primary.**
- **Communities retain agency.**
- **Models are participants, not authorities.**
- **Identity belongs to beings.** The `lid` is never recycled, never renamed,
  never derived from a database id.
- **Truth is traceable.** Chains are append-only; chain fields (`hash`,
  `previousHash`, `genesisHash`, `blockHeight`, `authorId`, chain `createdAt`)
  are frozen after creation; the Moment is golden
  (`GENESIS_MOMENT_MS = 1566149243000`, `domain/genesis.ts`).
- **The cap is intimacy.** 144 per node, enforced server-side
  (`functions/onLifetreeCreated`) — the client gate is courtesy, the function is law.
- **Conscience is collective and non-destructive.** The guardian veto needs ALL
  eligible guardians (author excluded), within 72 hours — and marks, never deletes.

## Practices — the habits the invariants grow; excellent today, allowed to evolve

- Read the root before acting; never silently contradict it; when the code
  reveals a better truth, propose a change to the root.
- Add a ring to `DECISIONS.md` after significant decisions. Correct with new
  rings, never rewrite — a knot isn't hidden; it's integrated.
- Green gates before merging: `npm run check`; rules changes also pass
  `npm run test:rules`.
- New logic begins in `domain/` as a pure, tested function.
- `ARCHITECTURE.md` is maintained beside the code, debts listed honestly.
- Deep roots permit greater speed: when first principles are clear, fewer
  decisions have to be rediscovered every week.
- **The code human translates, or becomes a priest.** One human who deeply
  understands the code may be enough for a small circle — but their
  understanding must continually flow into tests, architecture, readable
  explanations, review records, and teachable patterns. The ideal code human is
  not the only one allowed to see; they are responsible for helping everyone
  else see as far as they reasonably can.
