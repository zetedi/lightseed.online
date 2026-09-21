import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase/core';
import { linkId } from '../domain/link';
import type { Community } from '../types';
import type { HostStanding } from '../domain/pulseVisibility';

// WHERE THE VIEWER STANDS AT THE HOST (ring 2026-09-21): a member (the member link), a keeper
// (the founding owner or a keeper link). Two deterministic reads, re-asked when the hand or the
// place changes, and on the bus's 'communities' word. Grants nothing: the rules decide; this only
// lets the shell ASK for what the rules would allow (members-only events) and OFFER what they
// would accept (a keeper's members-only birth).
export function useHostStanding(uid: string | undefined, host: Community | null | undefined): HostStanding {
  const [standing, setStanding] = useState<HostStanding>({ member: false, keeper: false });
  const hostId = host?.id;
  const ownerId = host?.ownerId;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset-on-signout (or no host) before the async reads below, the shell's own convention
    if (!uid || !hostId) { setStanding({ member: false, keeper: false }); return; }
    let alive = true;
    Promise.all([
      getDoc(doc(db, 'links', linkId(uid, 'member', hostId))).then(s => s.exists()).catch(() => false),
      getDoc(doc(db, 'links', linkId(uid, 'keeper', hostId))).then(s => s.exists()).catch(() => false),
    ]).then(([member, keeperLink]) => {
      if (alive) setStanding({ member: member || keeperLink || ownerId === uid, keeper: keeperLink || ownerId === uid });
    });
    return () => { alive = false; };
  }, [uid, hostId, ownerId]);
  return standing;
}
