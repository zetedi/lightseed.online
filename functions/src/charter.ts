// THE CHARTER, server side (2026-11-14: no longer a mirror). The law — validation and every derivation —
// is src/domain/charter's, compiled into this build; this module only LOADS the node's own charter
// (functions/src/charter.json, written by scripts/charter-sync.mjs) and refuses to start on an unsound one.
import charterJson from "./charter.json";
import { charterProblem, charterOrigin, type Charter } from '../../src/domain/charter';
export { type CharterFace, type Charter, isDomainName, charterProblem, charterHosts, charterOrigin, charterOwnDomains, charterAuthHosts, mailFromOf, charterFaceDoor, charterPublicOf } from '../../src/domain/charter';

export const charter: Charter = charterJson as Charter;
const problem = charterProblem(charter);
if (problem) throw new Error(`functions/src/charter.json is not a sound charter: ${problem}`);
export const NODE_ORIGIN = charterOrigin(charter);
