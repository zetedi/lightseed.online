// The refresh bus — mutation sites announce WHAT changed ('lightHouses', 'events', …, with
// the doc id when they have one); mounted views showing that data re-fetch or prune. Views
// that aren't mounted need nothing: they load fresh on mount. Lazy by design — no polling,
// no global reloads, just a whisper across the open windows.

export type RefreshTopic = 'lightHouses' | 'events' | 'pulses' | 'trees' | 'beds' | 'communities';

export interface RefreshEvent {
  topic: RefreshTopic;
  id?: string; // the changed/removed doc, when the announcer knows it
  // The changed fields (ring 2026-08-22): an EDIT announces what changed, so any open list
  // merges the patch into its loaded copy — no refetch, no stale card. Absent = removal
  // (the feed prunes) or a plain refetch signal, exactly as before.
  patch?: Record<string, unknown>;
}

type Listener = (e: RefreshEvent) => void;
const listeners = new Set<Listener>();

export const announce = (topic: RefreshTopic, id?: string, patch?: Record<string, unknown>): void => {
  for (const l of [...listeners]) l({ topic, id, patch });
};

export const onRefresh = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
