import { useEffect } from 'react';
import { ensureIntelligenceCommons } from '../services/intelligence';
import {
  backfillPulseVisibility, migrateArraysToLinks, migratePulseTypeCasing, dropLegacyArrays, migrateTreeVisibility,
} from '../services/firebase';
import { setChainLocked, canonicalize, computeCanonicalHash, blockContent, verifyChain } from '../domain/chain';

// Superadmin-only devtools, attached to `window` (run from the deployed site's console). No React
// state — pure effects, self-cleaning on unmount. Extracted verbatim from App, plus the crystal
// testing handles (flip the in-memory chain lock to TEST canonical minting + expose the toolkit).
export function useSuperAdminConsole(isSuperAdmin: boolean, uid?: string) {
  useEffect(() => {
    if (isSuperAdmin && uid) ensureIntelligenceCommons(uid);
  }, [isSuperAdmin, uid]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    const w = window as any;
    // Backfill pulse visibility → 'public' on legacy pulses. Idempotent.
    w.backfillPulseVisibility = async () => {
      console.log('[lightseed] backfilling pulse visibility…');
      const n = await backfillPulseVisibility();
      console.log(`[lightseed] done — stamped visibility:"public" on ${n} legacy pulse(s).`);
      return n;
    };
    // LIN migration (stage 3): relationship arrays → links. Idempotent.
    w.migrateArraysToLinks = async () => {
      console.log('[lightseed] migrating relationship arrays → links…');
      const r = await migrateArraysToLinks();
      console.log('[lightseed] done — links created:', r);
      return r;
    };
    // Pulse type casing → canonical lowercase. Run once after deploy. Idempotent.
    w.migratePulseTypeCasing = async () => {
      console.log('[lightseed] migrating pulse type casing → lowercase…');
      const n = await migratePulseTypeCasing();
      console.log(`[lightseed] done — retyped ${n} pulse(s).`);
      return n;
    };
    // LIN migration (stage 5): drop legacy arrays — ONLY after links are live + verified.
    w.dropLegacyArrays = async () => {
      console.log('[lightseed] dropping legacy relationship arrays…');
      const n = await dropLegacyArrays();
      console.log(`[lightseed] done — cleared arrays on ${n} doc(s).`);
      return n;
    };
    // Backfill tree visibility → 'public'. Run ONCE after deploying indexes, BEFORE the tightened rules.
    w.migrateTreeVisibility = async () => {
      console.log('[lightseed] backfilling tree visibility → public…');
      const r = await migrateTreeVisibility();
      console.log(`[lightseed] done — stamped ${r.updated} tree(s).`);
      return r;
    };
    // Crystal: flip the in-memory chain lock to TEST canonical (verifiable) minting this session,
    // and expose the chain toolkit for manual console verification. (The real switch is the
    // node's About → Vision stamp, persisted on community.chainLocked.)
    w.setChainLocked = (v: boolean) => {
      setChainLocked(!!v);
      console.log(`[lightseed] chain lock ${v ? 'ON — new blocks sealed with the canonical hash' : 'OFF — legacy hashing'} (this session).`);
    };
    w.lightseedChain = { canonicalize, computeCanonicalHash, blockContent, verifyChain };
    return () => {
      delete w.backfillPulseVisibility; delete w.migrateArraysToLinks; delete w.migratePulseTypeCasing;
      delete w.dropLegacyArrays; delete w.migrateTreeVisibility; delete w.setChainLocked; delete w.lightseedChain;
    };
  }, [isSuperAdmin]);
}
