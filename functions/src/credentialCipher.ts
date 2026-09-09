// THE CIPHER OVER A STORED KEY (ring 2026-09-09). A BYO provider key used to rest in
// `providerCredentials` as plaintext: unreadable by every client (the rules), read back only by
// the Admin SDK — and open to any hand with project-level Firestore access, a console read, an
// export. Now the key rests as CIPHERTEXT under a Cloud KMS key that only the functions' own
// service account may use to encrypt and decrypt: a Firestore export yields ciphertext, the
// console yields ciphertext, and the plaintext exists only inside a running function for the
// length of one call. A secret this small (well under KMS's 64 KiB) is encrypted by the KMS key
// directly — no data key to envelope — which is what Google recommends for short secrets; the
// name "envelope" in the asking is honoured in effect, not in ceremony.
//
// The key ring and key follow a convention from the charter, so every node has its own:
//   projects/<project>/locations/<region>/keyRings/seed/cryptoKeys/provider-credentials
// created once per node (scripts/create-node.mjs step 6b) with the functions' service account
// granted roles/cloudkms.cryptoKeyEncrypterDecrypter on the key.
import { KeyManagementServiceClient } from "@google-cloud/kms";
import { charter } from "./charter";

export const KMS_KEY_NAME =
    `projects/${charter.firebase.projectId}/locations/${charter.firebase.region}/keyRings/seed/cryptoKeys/provider-credentials`;

let client: KeyManagementServiceClient | null = null;
const kms = () => (client ??= new KeyManagementServiceClient());

export interface SealedSecret { keyCiphertext: string; keyName: string }

// Plaintext → base64 ciphertext under the node's key. The key VERSION that sealed it rides in keyName.
export const sealSecret = async (plaintext: string): Promise<SealedSecret> => {
    const [res] = await kms().encrypt({ name: KMS_KEY_NAME, plaintext: Buffer.from(plaintext, "utf8") });
    if (!res.ciphertext) throw new Error("KMS returned no ciphertext");
    return { keyCiphertext: Buffer.from(res.ciphertext as Uint8Array).toString("base64"), keyName: res.name || KMS_KEY_NAME };
};

// Base64 ciphertext → plaintext. KMS picks the version from the ciphertext itself.
export const openSecret = async (keyCiphertext: string): Promise<string> => {
    const [res] = await kms().decrypt({ name: KMS_KEY_NAME, ciphertext: Buffer.from(keyCiphertext, "base64") });
    if (!res.plaintext) throw new Error("KMS returned no plaintext");
    return Buffer.from(res.plaintext as Uint8Array).toString("utf8");
};
