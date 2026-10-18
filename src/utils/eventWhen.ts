import { eventEndMs, eventStartMs, type EventSpan } from '../domain/eventSpan';

// The words a seat uses for WHEN (domain/eventSpan, ring 2026-10-18): one moment reads as it
// always did; a span reads "beginning – end", the end shortened to its hour when it falls on the
// beginning's day. Locale and zone are the reader's, as every date on these faces has been.
// `date` keeps only the days (a card's one line); `full` carries the hours.
export const whenOf = (span: EventSpan, style: 'full' | 'date' = 'full'): string | null => {
  const start = eventStartMs(span);
  if (start === null) return null;
  const a = new Date(start);
  const fmt = (d: Date) => (style === 'date' ? d.toLocaleDateString() : d.toLocaleString());
  const end = eventEndMs(span);
  if (end === null) return fmt(a);
  const b = new Date(end);
  if (a.toDateString() === b.toDateString()) {
    return style === 'date' ? fmt(a) : `${fmt(a)} – ${b.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  return `${fmt(a)} – ${fmt(b)}`;
};
