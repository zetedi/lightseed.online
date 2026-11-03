import raw from './charter.json';
import { charterProblem, charterHosts, charterOrigin, charterOwnDomains, charterAuthHosts, type Charter, type IndependentCharter, type NodeCharter } from '../domain/charter';

// THE NODE THIS SHELL RUNS AS (ring 2026-09-06) — the charter the checkout was synced to
// (scripts/charter-sync.mjs writes ./charter.json from node.json, or from NODE_CHARTER), read once. Every place the code
// used to name lightseed.online, its bucket, its keeper or its push key reads from here.
//
// THE SHELL WEARS THE CHARTER (ring 2026-11-03): an independent build carries ITS node's own
// version-2 charter instead — defined by the build as SEED_NODE_CHARTER from SEED_CHARTER
// (vite.config.ts, mode independent), while ./charter.json is left empty in that bundle so no
// trace of the origin's identity ships with another node. Under the Firebase soil, and in
// tests, SEED_NODE_CHARTER is null or undefined and the checkout's charter stands.
declare const SEED_NODE_CHARTER: IndependentCharter | null | undefined;
const independent: IndependentCharter | null = typeof SEED_NODE_CHARTER === 'undefined' ? null : SEED_NODE_CHARTER;
export const charter: NodeCharter = independent ?? (raw as Charter);
if (charter.version === 1) {
  const problem = charterProblem(charter);
  if (problem) console.error(`[lightseed] node.json is not a sound charter: ${problem}`);
}
// The Firebase soil's charter — only its own services ask (project, bucket, web config).
export const firebaseCharter = (): Charter => {
  if (charter.version !== 1) throw new Error('no_firebase_charter'); // an independent shell: a programmer's error, never a reader's
  return charter;
};
export const nodeOrigin = charterOrigin(charter);
export const nodeHosts = charterHosts(charter);
export const nodeDomains = charterOwnDomains(charter);
// The hosts that may be their own auth domain: the node's own, plus the faces the charter declares wired.
export const nodeAuthHosts = charterAuthHosts(charter);
