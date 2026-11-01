// The toast's BUS — the plain half of the toast, with no React in reach (the host in Toast.tsx
// is the face). One listener at a time: the single ToastHost mounted in App.
//
// A word spoken before the host stands is HELD (ring 2026-11-01): the /b/ door resolves while
// the shell still holds its neutral loader, so "this being is not public" was said to a room
// with no one in it — the listener was null and the word was dropped, for every visitor, since
// the pending door of 2026-09-29. The bus keeps the LAST such word and the host speaks it the
// moment it mounts — if it is still fresh. A word older than the hold is let go: it belongs to
// a page the reader has already left (a custom-landing domain mounts no host at all).

export type ToastKind = 'success' | 'error';
export interface ToastNote { message: string; kind: ToastKind }
export type ToastListener = (note: ToastNote) => void;

export const TOAST_HOLD_MS = 10_000;

export const createToastBus = () => {
  let listener: ToastListener | null = null;
  let held: (ToastNote & { at: number }) | null = null;
  return {
    // Said to the host if one listens; else held for the host to come.
    say(note: ToastNote, now: number = Date.now()): 'spoken' | 'held' {
      if (listener) { listener(note); return 'spoken'; }
      held = { ...note, at: now };
      return 'held';
    },
    // The host arrives. A fresh held word is spoken at once and returned; a stale one is let go.
    attach(fn: ToastListener, now: number = Date.now()): ToastNote | null {
      listener = fn;
      const pending = held;
      held = null;
      if (!pending || now - pending.at > TOAST_HOLD_MS) return null;
      const note = { message: pending.message, kind: pending.kind };
      fn(note);
      return note;
    },
    // The host leaves. Only the listener that attached may detach — a stale cleanup from an
    // earlier mount must not silence the host that replaced it.
    detach(fn: ToastListener): void {
      if (listener === fn) listener = null;
    },
    get listening(): boolean { return listener !== null; },
  };
};

export const toastBus = createToastBus();
