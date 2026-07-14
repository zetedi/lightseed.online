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
   propose a change to the root documents — the loop has no sovereign layer:
   *root ↕ code ↕ experience ↕ living beings and place ↕ reflection ↕ new ring.*
   Sometimes a tree dies while every gate remains green.

## Working rules

- The quality gate is `npm run check` (tsc strict + eslint + vitest); rules
  changes also need `npm run test:rules` (Firestore emulator). Keep both green.
- New logic starts in `src/domain/` as a pure, tested function.
- Relationships are LIN links (`from__rel__to`), never arrays.
- Chains are append-only: mark, never delete.
- Commit messages are short poetic lines ("Sanctuaries glow.", "Paper remembers.").
- **Commits are conscious**: the agent proposes a commit at natural completion
  points (message ready) — and always ASKS Zoltán before committing. Never
  commit or push unasked.
- **Review before commit**: every substantive batch gets a deep code review
  first — quality of understanding over surface checks; findings verified
  against the real code before they're believed. Review on FOUR layers:
  correctness (do tests prove the right thing), architecture (links-over-arrays,
  domain boundaries, root invariants), security & data integrity (permissions,
  ownership, migration risk, failure modes), and MEANING (does the
  implementation still express the concept, or has the metaphor begun hiding a
  weaker data model).
- **The rhythm**: inspect → understand → test → review → propose → ask →
  commit → record the ring. Never: change → commit → explain afterward.
- **Agents may propose and prepare commits. A human guardian authorizes
  consequential history** — responsibility stays locatable while beings cannot
  yet sign for themselves.
- We grow as fast as trees grow: prefer one whole, tested change over three
  hurried ones.
