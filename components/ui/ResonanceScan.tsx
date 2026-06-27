import React from 'react';

// The container waiting animation: while `active`, a soft scrim holds the wrapped content quiet
// (opaque) and a bright yellow dot with a halo — the little sun — travels ALONG the container's
// border. Same sun as <Loading/> (which orbits a centred circle when there's no container).
const SUN_GLOW = '0 0 12px 5px rgba(253,224,71,0.95), 0 0 28px 12px rgba(250,204,21,0.5)';
const ORBIT_KEYFRAMES = `@keyframes lightseed-orbit { from { offset-distance: 0%; } to { offset-distance: 100%; } }`;

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
    {children}
    {active && (
      <div className="absolute inset-0 z-20" aria-hidden>
        <style>{ORBIT_KEYFRAMES}</style>
        {/* Scrim — hold the content opaque/quiet while it updates. */}
        <div className="absolute inset-0 bg-white/75 backdrop-blur-[1px]" style={{ borderRadius: radius }} />
        {/* The little sun, travelling along the container's border. */}
        <span
          className="absolute left-0 top-0 h-3.5 w-3.5 rounded-full bg-yellow-300"
          style={{
            offsetPath: `inset(0 round ${radius})`,
            animation: 'lightseed-orbit 4s linear infinite',
            boxShadow: SUN_GLOW,
          }}
        />
      </div>
    )}
  </div>
);
