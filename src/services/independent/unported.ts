// WHAT THIS NODE HAS NOT GROWN YET (ring 2026-11-01). The independent backend mirrors every
// name the Firebase backend exports (src/services/backendParity.ts keeps the two in step), and a
// hand that is not ported yet stands here: it refuses at the moment it is asked, by name, and it
// never reaches for the origin node's Firebase. The refusal speaks one key (backend_unported) so
// every toast and dialog that shows an error's message says the same honest thing; the operation's
// name rides on the error for the console and for seed/PARITY.md's burn-down.
export class BackendUnported extends Error {
  constructor(readonly operation: string) {
    super('backend_unported');
    this.name = 'BackendUnported';
  }
}

export const isBackendUnported = (error: unknown): error is BackendUnported =>
  error instanceof BackendUnported || (error instanceof Error && error.message === 'backend_unported');

// Typed `any` on purpose: the stub is assigned to `typeof F.name`, so the Firebase signature is
// the contract and this one body serves every shape. Nearly every hand the shell calls is async,
// and the shell awaits or `.catch`es it — so the refusal is a REJECTED PROMISE, never a throw at
// the call: a synchronous throw inside an effect unmounted the whole shell on the first unported
// hand (the walk of 2026-11-01). The console names the operation so a walk shows which hand refused.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const unported = (operation: string): any => (): Promise<never> => {
  console.warn('[lightseed] not grown on this node:', operation);
  return Promise.reject(new BackendUnported(operation));
};

// The few hands whose Firebase twin answers synchronously (a value, never a promise): there a
// refusal must be a throw, because a promise where a value was expected fails later and worse.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const unportedSync = (operation: string): any => (): never => {
  console.warn('[lightseed] not grown on this node:', operation);
  throw new BackendUnported(operation);
};

// A LISTENER not yet grown (listenTo…, onSnapshot-shaped hands) must not throw: the shell
// calls it synchronously in an effect and would unmount whole on a throw. It says so once in the
// console, calls back nothing, and hands back an unsubscribe that has nothing to undo.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const unportedListener = (operation: string): any => (): (() => void) => {
  console.warn('[lightseed] not grown on this node (listener, silent):', operation);
  return () => {};
};
