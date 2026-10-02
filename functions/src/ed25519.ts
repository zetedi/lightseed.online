// ed25519.ts — the server's ONE Ed25519 verifier, pure (node:crypto only, no Firebase SDK), so the
// root test suite may import every law that verifies a signature (decisionSeal, blocks) without
// pulling firebase-functions into the root typecheck — CI installs only the root package
// (ring 2026-10-02: the quality gate was red for eight pushes over exactly that import).
import { createPublicKey, verify as verifySignature } from "node:crypto";

const canonicalBase64 = (value: string): boolean => {
    try {
        return Buffer.from(value, "base64").toString("base64") === value;
    } catch {
        return false;
    }
};

// Exported for the signed block (blocks.ts): one Ed25519 verifier on the server, whatever is signed.
export const verifiesEd25519 = (pubkey: string, signature: string, preimage: string): boolean => {
    try {
        if (!canonicalBase64(pubkey) || !canonicalBase64(signature)) return false;
        const key = createPublicKey({
            key: Buffer.from(pubkey, "base64"),
            format: "der",
            type: "spki",
        });
        return key.asymmetricKeyType === "ed25519"
            && verifySignature(
                null,
                Buffer.from(preimage, "utf8"),
                key,
                Buffer.from(signature, "base64"),
            );
    } catch {
        return false;
    }
};
