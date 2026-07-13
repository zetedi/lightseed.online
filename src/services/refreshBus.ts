// The refresh bus — mutation sites announce WHAT changed ('sanctuaries', 'events', …, with
// the doc id when they have one); mounted views showing that data re-fetch or prune. Views
// that aren't mounted need nothing: they load fresh on mount. Lazy by design — no polling,
// no global reloads, just a whisper across the open windows.

export type RefreshTopic = 'sanctuaries' | 'events' | 'pulses' | 'trees';

export interface RefreshEvent {
  topic: RefreshTopic;
  id?: string; // the changed/removed doc, when the announcer knows it
}

type Listener = (e: RefreshEvent) => void;
const listeners = new Set<Listener>();

export const announce = (topic: RefreshTopic, id?: string): void => {
  for (const l of [...listeners]) l({ topic, id });
};

export const onRefresh = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
