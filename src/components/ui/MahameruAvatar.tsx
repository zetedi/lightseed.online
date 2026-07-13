// Mahameru as a face — the starry sea of creation in a small round frame, on its own
// deep-night background. Wherever the network itself speaks (resonance readings, genesis
// badges, imageless events), this is its avatar; it replaced the old generic sparkle icon.
export const MahameruAvatar = ({ size, className = '' }: { size?: number; className?: string }) => (
  <span
    className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#04070f] ring-1 ring-amber-300/60 ${className}`}
    style={size ? { width: size, height: size } : undefined}
  >
    <img src="/mahameru.svg" alt="" className="h-full w-full object-cover" />
  </span>
);
