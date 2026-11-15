// THE ONE LAW (2026-11-14). THE LIGHT'S LAW (kindling, the prism, the last spend, witnessing) is src/domain/light's.
// The functions build compiles the shared domain itself (tsconfig rootDir '..'): the server judges by the
// very source the shell and the independent node judge by. Add law to src/domain, never here.
export { RAY_UNITS, WITNESS_SHARE_DENOMINATOR, witnessShareUnits, kindleDayKeyFromMs, DEFAULT_GLOW_SHARE_DENOMINATOR, NODE_GLOW_HOME, prismSplit, type DepartingRay, type RayRelease, releaseRay, type WitnessFacts, type WitnessJudgment, judgeWitness } from '../../src/domain/light';

// UUIDv7 (RFC 9562), mirrored from src/utils/id.ts: every Being's lid is time-ordered and
// portable (the LIN invariant; rays are beings too). The ten random bytes are a PARAMETER so
// this module stays pure and deterministic under test; index.ts hands in node:crypto's bytes.
export function uuidv7(atMs: number, random10: Uint8Array): string {
    if (random10.length < 10) throw new Error("uuidv7 needs 10 random bytes");
    const bytes = new Uint8Array(16);
    let ts = Math.max(0, Math.floor(atMs));
    for (let i = 5; i >= 0; i--) {
        bytes[i] = ts % 256;
        ts = Math.floor(ts / 256);
    }
    bytes.set(random10.subarray(0, 10), 6);
    bytes[6] = (bytes[6] & 0x0f) | 0x70;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
