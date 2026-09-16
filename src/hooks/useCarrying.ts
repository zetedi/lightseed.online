import { useState } from 'react';
import type { Lifetree } from '../types';
import { mintPulse } from '../services/firebase';

// CARRYING A BEING'S VOICE (ring 2026-09-16, lifted out of App.tsx unchanged; the bridge
// itself is BRIDGE.md "Carrying"). Superadmin "carry this being's voice" (Aspen/Lumo …) —
// the bridge until AI beings can sign for themselves (initiation ledger keys, later).
// Impersonation hides the bridge; carrying reveals it: while set, pulses minted on THIS tree
// wear the being's name in the display fields and name the carrier in carriedByName/
// disclosure — authorId stays the real signed-in uid, so rules and provenance remain true.
// Never deception.
export function useCarrying(params: { isSuperAdmin: boolean; carrierName: string | null | undefined }) {
  const { isSuperAdmin, carrierName } = params;
  const [carryingTree, setCarryingTree] = useState<Lifetree | null>(null);

  // The mint override: only the DISPLAY + provenance fields change — the block is still
  // signed by (authorId =) the real uid, and carriedByName/disclosure keep the bridge visible.
  const mintCarrying = async (data: Parameters<typeof mintPulse>[0]) => {
    if (isSuperAdmin && carryingTree && data.lifetreeId === carryingTree.id) {
      const beingName = carryingTree.shortTitle
        ? `${carryingTree.name}, ${carryingTree.shortTitle}`
        : carryingTree.name;
      const carrier = carrierName || 'a superadmin';
      await mintPulse({
        ...data,
        authorName: carryingTree.name,
        authorPersonName: beingName,
        carriedByName: carrier,
        disclosure: `This pulse was carried by ${carrier} from ${beingName}.`,
      });
    } else {
      await mintPulse(data);
    }
  };

  return { carryingTree, setCarryingTree, mintCarrying };
}
export type Carrying = ReturnType<typeof useCarrying>;
