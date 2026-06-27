import React from 'react';

/**
 * Wraps a box and, while `active`, sends a glowing lightseed — a yellow point with a soft
 * halo — travelling around its border, like the field being scanned for resonance.
 *
 * Uses CSS motion paths (offset-path) so the point follows the rounded rectangle exactly.
 */
export const ResonanceScan = ({
  active = false,
  radius = '0.75rem',
  children,
}: {
  active?: boolean;
  radius?: string;
  children: React.ReactNode;
}) => (
  <div className="relative">
    {active && (
      <div className="pointer-events-none absolute inset-0 z-10" aria-hidden>
        <style>{`@keyframes lightseed-orbit { from { offset-distance: 0%; } to { offset-distance: 100%; } }`}</style>
        <div className="absolute inset-0 animate-pulse rounded-2xl ring-1 ring-amber-300/40" style={{ borderRadius: radius }} />
        <span
          className="absolute left-0 top-0 h-2.5 w-2.5 rounded-full bg-amber-300"
          style={{
            offsetPath: `inset(0 round ${radius})`,
            animation: 'lightseed-orbit 4.5s linear infinite',
            boxShadow: '0 0 10px 4px rgba(252,211,77,0.9), 0 0 22px 9px rgba(251,191,36,0.45)',
          }}
        />
      </div>
    )}
    {children}
  </div>
);

/**
 * A full-screen waiting state for resonance / alignment matching: a single lighted seed
 * breathing at the CENTRE of the screen (over a soft dimmed backdrop), instead of a point
 * orbiting a box border.
 */
export const CenteredResonanceLoader = ({
  active = false,
  label = 'Reading the field…',
}: {
  active?: boolean;
  label?: string;
}) => {
  if (!active) return null;
  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-slate-900/40 backdrop-blur-sm" aria-hidden>
      <style>{`@keyframes lightseed-breathe { 0%,100% { transform: scale(0.85); opacity: 0.7; } 50% { transform: scale(1.15); opacity: 1; } }`}</style>
      <div className="relative flex items-center justify-center">
        <span className="absolute h-24 w-24 rounded-full bg-amber-300/30 blur-xl" style={{ animation: 'lightseed-breathe 2.4s ease-in-out infinite' }} />
        <span
          className="h-12 w-12 rounded-full bg-amber-300"
          style={{
            animation: 'lightseed-breathe 2.4s ease-in-out infinite',
            boxShadow: '0 0 18px 6px rgba(252,211,77,0.9), 0 0 40px 16px rgba(251,191,36,0.45)',
          }}
        />
      </div>
      {label && <p className="mt-6 text-sm font-medium tracking-wide text-amber-100">{label}</p>}
    </div>
  );
};
