import React from 'react';
import { Icons } from './ui/Icons';

interface ValidationBadgeProps {
  className?: string;
  compact?: boolean;
  // Validated but gone quiet — the badge dims until the tree is tended again.
  lapsed?: boolean;
}

// The validation sigil is an eye — observation. A validated ("observed") tree carries this
// badge. When its care has lapsed, the eye dims to amber and asks to be tended.
export const ValidationBadge = ({ className = '', compact = false, lapsed = false }: ValidationBadgeProps) => {
  const stampSize = compact ? 'h-8 w-8' : 'h-12 w-12';
  const eyeSize = compact ? 18 : 26;
  const tone = lapsed
    ? 'bg-amber-400/80 text-white/90 shadow-amber-900/20'
    : 'bg-emerald-500 text-white shadow-emerald-900/30';

  return (
    <span
      title={lapsed ? 'Validation lapsed — needs tending' : 'Validated'}
      aria-label={lapsed ? 'Validation lapsed' : 'Validated'}
      className={`relative inline-flex shrink-0 items-center justify-center rounded-full ring-2 ring-white/70 shadow-lg ${tone} ${stampSize} ${className}`}
    >
      <Icons.Eye size={eyeSize} />
    </span>
  );
};
