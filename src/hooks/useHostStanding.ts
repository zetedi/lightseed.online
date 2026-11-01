import { useEffect, useState } from 'react';
import { graphStore } from '../services/store';
import type { Community } from '../types';
import type { HostStanding } from '../domain/pulseVisibility';

// WHERE THE VIEWER STANDS AT THE HOST (ring 2026-09-21): a member (the member link), a keeper
// (the founding owner or a keeper link). Two deterministic reads through the graph store (ring
// 2026-11-01: the hook once opened the two link documents itself), re-asked when the hand or the
// place changes, and on the bus's 'communities' word. Grants nothing: the rules decide; this only
// lets the shell ASK for what the rules would allow (members-only events) and OFFER what they
// would accept (a keeper's members-only birth).
export function useHostStanding(uid: string | undefined, host: Community | null | undefined): HostStanding {
  const [standing, setStanding] = useState<HostStanding>({ member: false, keeper: false });
  const hostId = host?.id;
  const anchorUid = host?.anchorUid;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset-on-signout (or no host) before the async reads below, the shell's own convention
    if (!uid || !hostId) { setStanding({ member: false, keeper: false }); return; }
    let alive = true;
    const holds = (rel: 'member' | 'keeper') =>
      graphStore.linksFrom(uid, rel).then(links => links.some(l => l.to === hostId)).catch(() => false);
    Promise.all([holds('member'), holds('keeper')]).then(([member, keeperLink]) => {
      if (alive) setStanding({ member: member || keeperLink || anchorUid === uid, keeper: keeperLink || anchorUid === uid });
    });
    return () => { alive = false; };
  }, [uid, hostId, anchorUid]);
  return standing;
}
