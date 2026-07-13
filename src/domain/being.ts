import type { Timestamp } from 'firebase/firestore';

// The Being — the concept every entity in the network instantiates. Indra's net: every jewel
// is different, and every jewel reflects all the others the same way.
//
// A Being has four aspects:
//   - a TRUE NAME  — the lid, a UUIDv7 (utils/id.ts) carrying its birth-time in the first 48
//                    bits; portable across nodes and years, independent of any storage backend.
//   - a STORY      — its chain: pulses keyed by the being's ids, hash-linked, unerasable.
//                    Rendered for every being by sections/ChainTree (the digital tree).
//   - a CIRCLE     — its links: the LIN, the relations in the `links` collection
//                    (guardian, member, participant, co_owner, …).
//   - a FACE       — its profile: the shared anatomy in components/sections/ (Vision, Events,
//                    Trees, Sanctuary, Intelligence, Appearance, AlignmentView, ChainTree).
//                    Composite beings (communities, nodes) additionally grow a Council — the
//                    organ by which many become one voice.
//
// Humans, AIs, communities, nodes, trees — all Beings. The lid backfill completed 2026-07-09:
// since that day, no stored being is nameless.
//
// `lid` stays optional in the TYPE because the type also describes in-flight objects before
// their first write, and docs on other nodes' databases that may predate their own backfill.
// Every doc stored on THIS node carries one — minted at creation, or backfilled.
export interface Being {
  lid?: string;          // Lightseed ID — the true name.
  // The minted offline link: the exact URL this being's QR was generated with
  // (domain/beingLink). Stale when the home domain moves; a keeper re-mints.
  qr?: { href: string };
  createdAt?: Timestamp; // the birth time; optional on the base (derived/transient objects),
                         // required by concrete stored types that always stamp it.
}
