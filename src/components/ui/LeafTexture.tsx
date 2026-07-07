
// A faint, tiling leaf-vein texture (the events-banner motif), reusable as a section background.
// `fade` masks it out toward the bottom; `stroke`/`opacity` tune it for light or dark grounds.
export const LeafTexture = ({
  stroke = '#059669',
  opacity = 0.07,
  fade = false,
}: { stroke?: string; opacity?: number; fade?: boolean }) => (
  <svg
    className="pointer-events-none absolute inset-0 h-full w-full"
    style={{
      opacity,
      ...(fade ? { maskImage: 'linear-gradient(to bottom, black, transparent)', WebkitMaskImage: 'linear-gradient(to bottom, black, transparent)' } : {}),
    }}
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <defs>
      <pattern id="leafvein-shared" width="66" height="66" patternUnits="userSpaceOnUse" patternTransform="rotate(14)">
        <path d="M33 6 C 50 20, 50 46, 33 60 C 16 46, 16 20, 33 6 Z" fill="none" stroke={stroke} strokeWidth="1.1" />
        <path d="M33 6 L33 60 M33 18 L45 13 M33 18 L21 13 M33 31 L47 25 M33 31 L19 25 M33 44 L43 40 M33 44 L23 40" stroke={stroke} strokeWidth="0.7" fill="none" />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#leafvein-shared)" />
  </svg>
);
