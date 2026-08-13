// THE HASH IS CHAIN LAW (ring 2026-08-14) — sha256 and the block seal lived in utils/crypto,
// but they are the chain's own arithmetic: verify.ts recomputes them, every genesis (the
// Aspen's block 000 among them) is reproducible only through THIS exact payload shape. They
// live here so @lightseed/domain carries its whole law. Runtime requirement: Web Crypto
// (crypto.subtle) — every browser, Node ≥ 19. utils/crypto re-exports for old call sites.

export async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

// The legacy (v0) block seal: JSON.stringify(data) + previousHash + timestamp. The canonical
// v1 algorithm (BLOCK_HASH_VERSION, chain/canonical.ts) supersedes it for new chains; this
// stays because stored hashes were born from it and must remain reproducible forever.
export async function createBlock(
  previousHash: string,
  data: object,
  timestamp: number
): Promise<string> {
  const payload = JSON.stringify(data) + previousHash + timestamp;
  return await sha256(payload);
}
