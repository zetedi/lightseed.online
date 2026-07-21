// Beds in lightHouses — the last link of the self-sustaining chain: a tree, a circle, a
// community, a domain, a BED — and a way to start a new world from there. A stay is a
// request to sleep under a lightHouse's roof; the keeper answers. The payment rail joins
// later with the rest of the care economy (domain/support.ts) — the structure is whole now.

import type { Being } from './being';

export type StayStatus = 'requested' | 'accepted' | 'declined';

// A stay is a Being (requestStay mints its lid at birth); the type now says so too — the
// declaration had lagged the lived law until the 2026-07-21 lid audit.
export interface Stay extends Being {
  id: string;
  bedId: string;        // the reserved BED being — the anchor of a stay (a bed holds one guest
                        // at a time). The rules verify hostUid against THIS bed's ownerId.
  bedName?: string;     // denormalised for the host inbox and the guest's own list
  lightHouseId: string; // the bed's house for context/queries — '' for a loose bed
  lightHouseName?: string;
  uid: string;          // the guest
  guestName?: string;
  // The guest's shared face, denormalised at request time. The host cannot read the guest's
  // users doc (rules), so the tree the guest chooses to show rides on the stay itself.
  guestTreeId?: string;
  guestTreeName?: string;
  guestTreeGrowthUrl?: string;
  hostUid: string;      // the BED's ownerId at request time (denormalised — the rules and the
                        // keeper's inbox query stand on this field)
  fromDate: string;     // yyyy-mm-dd
  toDate: string;       // yyyy-mm-dd (departure day — nights = to - from)
  nights: number;
  note?: string;
  status: StayStatus;
  leafed?: boolean;     // true once a COMPLETED stay has been minted as a leaf on the bed's chain
}

const DAY_MS = 86400000;
export const MAX_STAY_NIGHTS = 90;

export const nightsBetween = (fromDate: string, toDate: string): number => {
  const a = Date.parse(fromDate);
  const b = Date.parse(toDate);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / DAY_MS);
};

// Why this request cannot stand — or null when it may. Dates are date-only strings; "today"
// is derived from nowMs in the caller's clock.
export const stayRequestProblem = (fromDate: string, toDate: string, nowMs: number): string | null => {
  if (!fromDate || !toDate) return 'Choose the nights: arrival and departure.';
  const nights = nightsBetween(fromDate, toDate);
  if (nights <= 0) return 'Departure must come after arrival.';
  if (nights > MAX_STAY_NIGHTS) return `A stay is at most ${MAX_STAY_NIGHTS} nights — beyond that, join the community.`;
  const today = new Date(nowMs);
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  if (fromDate < todayStr) return 'The arrival night is already in the past.';
  return null;
};

// Do two stays share any night? (Departure day is free — [from, to) intervals.)
export const staysOverlap = (a: Pick<Stay, 'fromDate' | 'toDate'>, b: Pick<Stay, 'fromDate' | 'toDate'>): boolean =>
  a.fromDate < b.toDate && b.fromDate < a.toDate;

// How many beds remain free for a candidate range, given the accepted stays. (Count-based —
// the old whole-house offer; kept for its tests. Per-bed reservations use bedIsFreeFor below.)
export const bedsFreeFor = (
  beds: number,
  accepted: Pick<Stay, 'fromDate' | 'toDate'>[],
  fromDate: string,
  toDate: string,
): number => {
  const range = { fromDate, toDate };
  const taken = accepted.filter(s => staysOverlap(s, range)).length;
  return Math.max(0, beds - taken);
};

// A single bed holds ONE guest at a time: is the candidate range free of accepted stays for
// THIS bed? (Departure-day-free, via staysOverlap.)
export const bedIsFreeFor = (
  bedId: string,
  accepted: Pick<Stay, 'bedId' | 'fromDate' | 'toDate'>[],
  fromDate: string,
  toDate: string,
): boolean => {
  const range = { fromDate, toDate };
  return !accepted.some(s => s.bedId === bedId && staysOverlap(s, range));
};
