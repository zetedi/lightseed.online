# Rooting

Every intelligence entering this project roots first in the same living context.

**Before acting:**
1. Read `root/GENESIS.md` — why we exist (the promise; changes only with great care).
2. Read `root/LIN.md` — what world we are creating (ontology, principles, invariants).
3. Read `root/ARCHITECTURE.md` — how it currently lives.
4. Read the newest rings in `root/DECISIONS.md`.
5. Read the current section of `root/ROADMAP.md`.
6. Inspect the code and Git history — `BRIDGE.md` maps the beings to the code.
7. **Never silently contradict the root.** When the code reveals a better truth,
   propose a change to the root documents — the relationship is circular:
   *seed → code → experience → reflection → clearer seed.*

## Working rules

- The quality gate is `npm run check` (tsc strict + eslint + vitest); rules
  changes also need `npm run test:rules` (Firestore emulator). Keep both green.
- New logic starts in `src/domain/` as a pure, tested function.
- Relationships are LIN links (`from__rel__to`), never arrays.
- Chains are append-only: mark, never delete.
- Commit messages are short poetic lines ("Sanctuaries glow.", "Paper remembers.").
- We grow as fast as trees grow: prefer one whole, tested change over three
  hurried ones.
