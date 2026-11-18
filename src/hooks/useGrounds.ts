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

const NO_ASKS: GroundOf<unknown>[] = [];
const useBothLists = <T,>(id: string, readStanding: (id: string) => Promise<GroundOf<T>[]>, readAsks: (id: string) => Promise<GroundOf<T>[]>) => {
  // The reading remembers whose it is: when the face turns to another being, the last being's
  // grounds are never shown (or reported upward) under the new one's name.
  const [read, setRead] = useState<{ id: string; standing: GroundOf<T>[]; asks: GroundOf<T>[] } | null>(null);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    let alive = true;
    Promise.all([readStanding(id), readAsks(id)])
      .then(([standing, asks]) => { if (alive) setRead({ id, standing, asks }); })
      // A reading that failed stays unread (null): a face must not say "seeking ground", nor a page
      // take a Root Vision for an ordinary one, on the strength of a read that never landed.
      .catch(() => {});
    return () => { alive = false; };
  }, [id, nonce, readStanding, readAsks]);
  const reload = useCallback(() => setNonce(n => n + 1), []);
  const mine = read?.id === id ? read : null;
  return { standing: mine ? mine.standing : null, asks: mine ? mine.asks : NO_ASKS as GroundOf<T>[], reload };
};

// A tree's side: the visions grounded in it, and the visions knocking.
export const useTreeGrounds = (treeId: string) => useBothLists<Vision>(treeId, getVisionsGroundedIn, getGroundAsksAt);
// A vision's side: the trees it stands in, and the trees it is still asking.
export const useVisionGrounds = (visionId: string) => useBothLists<Lifetree>(visionId, getGroundsOfVision, getGroundAsksOfVision);
