// THE DECISION'S SEAL, RE-VERIFIED ON SERVER GROUND (ring 2026-09-30, "Spending is a gate").
// A decision's `status: 'passed'` is a client-flipped flag (the rules let the proposer, a keeper
// or staff flip it); the SEAL is the signatures. Before the commons moves, the server counts the
// signatures the way any reader can — the ONE counting rule of src/domain/decision.ts
// (verifiedDecisionSigners), counted here over the server's own facts:
//   (1) at most one counted signature per signer; (2) in consensus mode only 'unite' counts;
//   (3) the recorded key binds to the signer — the current published key, or a key in the
//       signer's append-only lineage, judged at the signature's receipt time (keyEpoch);
//   (4) the signature verifies the payload bound to the RECORD'S OWN uid (never transferable).
// Held to the domain by tests/decisionSeal.test.ts, which signs with a real Ed25519 key.
import { createHash } from "node:crypto";
import { signingPreimage } from "./birth";
import { verifiesEd25519 } from "./ed25519";
import { keyStandingAt, keyStandingCounts, type KeyEpoch, type KeyEvent } from "./keyEpoch";

// WHAT IS SIGNED is the domain's own (2026-11-14, compiled into this build, no longer copied): the two
// tags, the decision identity and the two payloads. Only the COUNTING below stays the server's — it reads
// the signer's standing from documents the shell never holds (lineage, epochs, events, membership).
import { DECISION_DOMAIN, DECISION_EPOCH_DOMAIN, decisionIdentity, decisionSignaturePayload, decisionEpochSignaturePayload, type DecisionIdentity, type DecisionNature } from '../../src/domain/decision';
export { DECISION_DOMAIN, DECISION_EPOCH_DOMAIN, decisionIdentity, decisionSignaturePayload, decisionEpochSignaturePayload, type DecisionIdentity, type DecisionNature };

// The fingerprint of a published key: sha256 hex of its base64 text (the shell's keyFingerprint).
export const fingerprintOf = (pubkeyB64: string): string => createHash("sha256").update(pubkeyB64, "utf8").digest("hex");

export interface RecordedDecisionSignature {
    uid: string;              // the doc id — path-authoritative
    sig: string;
    pubkey: string;
    position?: unknown;       // 'unite' | 'stand_aside' | 'block' in consensus mode
    version?: unknown;        // 3 = epoch-bound
    keyFingerprint?: unknown;
    epochId?: unknown;
    recordedAtMs: number | null;
}

// Everything the server read about one signer: persons/{uid}, its keys lineage and key events.
export interface SignerFacts {
    publicKeyPem: string;         // the current published key ('' = none)
    currentFingerprint: string;
    lineage: ReadonlyMap<string, string>; // fingerprint → pubkey, from persons/{uid}/keys
    epochs: readonly KeyEpoch[];
    events: readonly KeyEvent[];
    member: boolean;              // stands in the decision's community (member link, or its anchor)
}

// A recorded key binds to the signer iff it is in the lineage (or equals the current key) and,
// for an epoch-bound signature, its epoch stood at the receipt time (mirror of
// covenant.signatureBindsToIdentityOrLineage + services/keys.isKeyInLineage).
const bindsToSigner = (s: RecordedDecisionSignature, facts: SignerFacts): boolean => {
    const inLineage = facts.lineage.get(fingerprintOf(s.pubkey)) === s.pubkey;
    if (s.version === 3) {
        if (!inLineage || typeof s.keyFingerprint !== "string" || typeof s.epochId !== "string" || s.recordedAtMs === null) return false;
        if (fingerprintOf(s.pubkey) !== s.keyFingerprint) return false;
        return keyStandingCounts(keyStandingAt(
            { epochId: s.epochId, keyFingerprint: s.keyFingerprint, recordedAtMs: s.recordedAtMs },
            facts.epochs, facts.events, facts.currentFingerprint,
        ));
    }
    return (!!facts.publicKeyPem && s.pubkey === facts.publicKeyPem) || inLineage;
};

// The set of VERIFIED signer uids — the server's count of the seal.
export const verifiedDecisionSigners = (
    identity: DecisionIdentity,
    mode: "threshold" | "consensus",
    sigs: readonly RecordedDecisionSignature[],
    signers: ReadonlyMap<string, SignerFacts>,
): Set<string> => {
    const counted = new Set<string>();
    for (const s of sigs) {
        if (counted.has(s.uid)) continue;
        if (mode === "consensus" && s.position !== "unite") continue;
        const facts = signers.get(s.uid);
        if (!facts || !facts.member) continue;
        if (typeof s.sig !== "string" || typeof s.pubkey !== "string" || !s.sig || !s.pubkey) continue;
        if (!bindsToSigner(s, facts)) continue;
        const epochBound = s.version === 3 && typeof s.keyFingerprint === "string" && typeof s.epochId === "string";
        const payload = epochBound
            ? decisionEpochSignaturePayload(identity, s.uid, s.keyFingerprint as string, s.epochId as string)
            : decisionSignaturePayload(identity, s.uid);
        const domain = epochBound ? DECISION_EPOCH_DOMAIN : DECISION_DOMAIN;
        if (verifiesEd25519(s.pubkey, s.sig, signingPreimage(domain, payload))) counted.add(s.uid);
    }
    return counted;
};
