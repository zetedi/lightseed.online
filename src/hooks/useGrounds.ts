import { useCallback, useEffect, useState } from 'react';
import type { Lifetree, Vision } from '../types';
import {
  askGround, acceptGround, releaseGround, dropGroundAsk, getMyVisions,
  getVisionsGroundedIn, getGroundAsksAt, getGroundsOfVision, getGroundAsksOfVision, type GroundOf,
} from '@backend';

// THE GROUND, FOR THE FACES (domain/grounding, ring 2026-11-17). The two faces of a ground — a
// tree's visions and a vision's trees — read and act through this hook, never by their own hand
// (eslint.faces-ratchet). `standing` is null until the first reading lands, so a face can stay
// silent rather than say "seeking ground" about a vision it has not read yet.
export type { GroundOf };

// The acts. Each is the server's to judge; a refusal arrives as an Error whose message is a
// dictionary key.
export const groundActs = {
  ask: askGround,
  accept: acceptGround,
  release: releaseGround,
  dropAsk: dropGroundAsk,
  myVisions: getMyVisions,
};

const useBothLists = <T,>(id: string, readStanding: (id: string) => Promise<GroundOf<T>[]>, readAsks: (id: string) => Promise<GroundOf<T>[]>) => {
  const [standing, setStanding] = useState<GroundOf<T>[] | null>(null);
  const [asks, setAsks] = useState<GroundOf<T>[]>([]);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    let alive = true;
    Promise.all([readStanding(id), readAsks(id)])
      .then(([g, a]) => { if (alive) { setStanding(g); setAsks(a); } })
      .catch(() => { if (alive) setStanding(prev => prev ?? []); });
    return () => { alive = false; };
  }, [id, nonce, readStanding, readAsks]);
  const reload = useCallback(() => setNonce(n => n + 1), []);
  return { standing, asks, reload };
};

// A tree's side: the visions grounded in it, and the visions knocking.
export const useTreeGrounds = (treeId: string) => useBothLists<Vision>(treeId, getVisionsGroundedIn, getGroundAsksAt);
// A vision's side: the trees it stands in, and the trees it is still asking.
export const useVisionGrounds = (visionId: string) => useBothLists<Lifetree>(visionId, getGroundsOfVision, getGroundAsksOfVision);
