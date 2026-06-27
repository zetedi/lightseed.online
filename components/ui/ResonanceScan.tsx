import React from 'react';

// The one waiting animation across the app: a bright yellow dot with a soft halo — a little
// sun — travelling along a path. Over a container that's updating it follows the container's
// border (ResonanceScan); with no container it orbits a logo-sized circle in the middle of the
// page (CenteredResonanceLoader). Both share this dot so the wait always reads the same.
const SUN_GLOW = '0 0 12px 5px rgba(253,224,71,0.95), 0 0 30px 14px rgba(250,204,21,0.5)';
const ORBIT_KEYFRAMES = `@keyframes lightseed-orbit { from { offset-distance: 0%; } to { offset-distance: 100%; } }`;

/**
 * Wraps a box and, while `active`, sends the little sun travelling around its border, like the
 * field being scanned for resonance. Uses CSS motion paths (offset-path) so the point follows
 * the rounded rectangle exactly.
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
        <style>{ORBIT_KEYFRAMES}</style>
        <div className="absolute inset-0 animate-pulse rounded-2xl ring-1 ring-amber-300/40" style={{ borderRadius: radius }} />
        <span
          className="absolute left-0 top-0 h-3.5 w-3.5 rounded-full bg-yellow-300"
          style={{
            offsetPath: `inset(0 round ${radius})`,
            animation: 'lightseed-orbit 4.5s linear infinite',
            boxShadow: SUN_GLOW,
          }}
        />
      </div>
    )}
    {children}
  </div>
);

/**
 * A full-screen waiting state for actions with no specific container: the little sun orbits a
 * faint, logo-sized circle in the centre of the screen over a softly dimmed backdrop.
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
      <style>{ORBIT_KEYFRAMES}</style>
      {/* The orbit circle is sized like the logo (~88px). */}
      <div className="relative" style={{ width: '88px', height: '88px' }}>
        <div className="absolute inset-0 rounded-full ring-1 ring-amber-300/25" />
        <span
          className="absolute left-0 top-0 h-3.5 w-3.5 rounded-full bg-yellow-300"
          style={{
            offsetPath: 'circle(44px at 50% 50%)',
            animation: 'lightseed-orbit 3.6s linear infinite',
            boxShadow: SUN_GLOW,
          }}
        />
      </div>
      {label && <p className="mt-6 text-sm font-medium tracking-wide text-amber-100">{label}</p>}
    </div>
  );
};
