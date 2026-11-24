// WHO CAN READ THE CHARTER (2026-11-19). The installer writes the node's charter owner-only, and
// the API reads it inside its container as UID 1000. Whether that hand can read the file is
// decided by the machine, before anything is written:
//   'as_is'  — the container's UID 1000 is the installing account (or Docker's own machine maps
//              ownership, as Docker Desktop does): nothing to do.
//   'give'   — the installer is root: it gives the charter to UID 1000 after writing it, and
//              the files stay owner-only.
//   'refuse' — no arrangement the installer can make would let the API read its charter; the
//              installation is refused in the preflight, with the reason.
// Pure: the caller supplies what it observed (process.platform, process.getuid(), `docker info`).
export const SEED_API_UID = 1000;

/**
 * @param {{ platform: string, uid: number, dockerDesktop?: boolean, securityOptions?: readonly unknown[] }} observed
 * @returns {{ action: 'as_is' | 'give' } | { action: 'refuse', reason: 'remapped_daemon' | 'foreign_account' }}
 */
export function charterCustodyOf({ platform, uid, dockerDesktop = false, securityOptions = [] }) {
  if (platform !== 'linux' || dockerDesktop) return { action: 'as_is' };
  // A remapped or rootless daemon runs the container's UID 1000 as some other account of the
  // machine: neither the installing account's files nor a gift to UID 1000 would be readable.
  const remapped = securityOptions.some(option => /(^|[=,])(rootless|userns)\b/.test(String(option)));
  if (remapped) return { action: 'refuse', reason: 'remapped_daemon' };
  if (uid === SEED_API_UID) return { action: 'as_is' };
  if (uid === 0) return { action: 'give' };
  return { action: 'refuse', reason: 'foreign_account' };
}
