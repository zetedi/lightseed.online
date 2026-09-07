import { useEffect, useRef, useState } from 'react';
import { AUTOSAVE_DELAY_MS, canonical, patchOf, type AutosaveState } from '../domain/autosave';

// AUTOSAVE, the WHEN (ring 2026-09-07) — the law of WHAT is domain/autosave. Each render the
// hook asks the law what differs between what is persisted and what the hand has shaped; a
// non-empty patch waits one breath (the delay) after the LAST change and then rides one write.
// Writes never overlap: a change during a write waits for it and rides the next. A write that
// lands is remembered here (the overlay) until the persisted prop catches up, so nothing is
// written twice; a write that fails leaves the draft as it is — the next edit tries again with
// everything still unsaved. Leaving the screen with a change pending fires the write at once.
export function useAutosave<T extends object>({ persisted, draft, keys, save, delay = AUTOSAVE_DELAY_MS, resetKey }: {
  persisted: T;
  draft: T;
  keys: readonly (keyof T)[];
  save: (patch: Partial<T>) => Promise<void>;
  delay?: number;
  // A new subject (another community, another person) forgets what was saved for the last.
  resetKey?: string;
}): { state: AutosaveState; error: string | null } {
  const [state, setState] = useState<AutosaveState>('idle');
  const [error, setError] = useState<string | null>(null);
  const persistedRef = useRef(persisted);
  const draftRef = useRef(draft);
  const overlayRef = useRef<Partial<T>>({});
  const saveRef = useRef(save);
  const inFlight = useRef<Promise<void> | null>(null);
  const timer = useRef<number | null>(null);
  persistedRef.current = persisted;
  draftRef.current = draft;
  saveRef.current = save;

  const pending = () => patchOf({ ...persistedRef.current, ...overlayRef.current } as T, draftRef.current, keys);
  const patchKey = canonical(pending());

  useEffect(() => { overlayRef.current = {}; }, [resetKey]);

  useEffect(() => {
    if (patchKey === '{}') return;
    setState('pending');
    const run = async () => {
      timer.current = null;
      if (inFlight.current) await inFlight.current.catch(() => {});
      const patch = pending();
      if (canonical(patch) === '{}') { setState('saved'); return; }
      setState('saving');
      const write = saveRef.current(patch)
        .then(() => { overlayRef.current = { ...overlayRef.current, ...patch }; setError(null); setState('saved'); })
        .catch((e: unknown) => { setError(e instanceof Error ? e.message : String(e)); setState('error'); });
      inFlight.current = write;
      await write;
      inFlight.current = null;
    };
    timer.current = window.setTimeout(() => { void run(); }, delay);
    return () => {
      if (timer.current !== null) { window.clearTimeout(timer.current); timer.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the patch's spelling; refs carry the rest
  }, [patchKey, delay]);

  // Leaving with a change still waiting: write now rather than lose it. (The timer effect's
  // own cleanup has already run by now, so this asks the law afresh instead of the timer;
  // a write still in flight is let land first, and only what it did not carry follows.)
  useEffect(() => () => {
    const flush = () => {
      const patch = patchOf({ ...persistedRef.current, ...overlayRef.current } as T, draftRef.current, keys);
      if (canonical(patch) !== '{}') void saveRef.current(patch).catch(() => {});
    };
    if (inFlight.current) void inFlight.current.catch(() => {}).then(flush);
    else flush();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unmount only; refs carry the rest
  }, []);

  return { state, error };
}
