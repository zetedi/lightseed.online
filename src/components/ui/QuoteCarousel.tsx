import { useEffect, useRef, useState } from 'react';

// A responsive, full-width text carousel of reflections — shown to signed-out visitors in place
// of the home/observatory cards. Auto-advances, but pauses on hover/focus, honours
// prefers-reduced-motion, supports keyboard (arrows/dots), and swipe on touch. Kept compact so
// the hero + footer fit one laptop viewport.
export const QuoteCarousel = ({ quotes, intervalMs = 8000 }: { quotes: string[]; intervalMs?: number }) => {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);
  const reduced = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const go = (n: number) => setI(((n % quotes.length) + quotes.length) % quotes.length);

  useEffect(() => {
    if (paused || reduced || quotes.length < 2) return;
    const id = window.setInterval(() => setI(p => (p + 1) % quotes.length), intervalMs);
    return () => window.clearInterval(id);
  }, [paused, reduced, quotes.length, intervalMs]);

  if (!quotes.length) return null;
  const q = quotes[i];
  const long = q.length > 160;

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Lightseed reflections"
      className="relative w-full rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-sky-50 px-8 py-5 shadow-sm sm:px-10 sm:py-16"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (touchX.current == null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (dx > 40) go(i - 1); else if (dx < -40) go(i + 1);
        touchX.current = null;
      }}
    >
      {/* Compact on mobile so the whole hero (light path + carousel + cards + footer) fits one
          screen; the text size is FLUID — it scales with the viewport via clamp(). */}
      <div aria-live="polite" className="mx-auto flex h-[clamp(3.5rem,14vh,7rem)] max-w-3xl items-center justify-center overflow-hidden sm:h-[clamp(5rem,24vh,11rem)]">
        <p
          key={i}
          dir="auto"
          className="animate-in fade-in duration-700 text-center font-serif italic leading-relaxed text-slate-700"
          style={{ fontSize: long ? 'clamp(0.8rem, 1.6vw + 0.55rem, 1.25rem)' : 'clamp(1rem, 2vw + 0.6rem, 1.5rem)' }}
        >
          {q}
        </p>
      </div>

      {quotes.length > 1 && (
        <>
          {/* SVG chevrons (not text glyphs) so the arrow sits dead center in the round button. */}
          <button onClick={() => go(i - 1)} aria-label="Previous reflection"
            className="absolute -left-1 sm:-left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 ring-1 ring-emerald-100 text-slate-500 shadow transition-colors hover:bg-white hover:text-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <button onClick={() => go(i + 1)} aria-label="Next reflection"
            className="absolute -right-1 sm:-right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 ring-1 ring-emerald-100 text-slate-500 shadow transition-colors hover:bg-white hover:text-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
          </button>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:mt-5">
            {quotes.map((_, n) => (
              <button key={n} onClick={() => go(n)} aria-label={`Reflection ${n + 1}`} aria-current={n === i}
                className={`h-2 rounded-full transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${n === i ? 'w-6 bg-emerald-600' : 'w-2 bg-emerald-200 hover:bg-emerald-300'}`} />
            ))}
          </div>
        </>
      )}
    </section>
  );
};
