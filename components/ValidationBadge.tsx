import React from 'react';
import { Icons } from './ui/Icons';

interface ValidationBadgeProps {
  className?: string;
  compact?: boolean;
}

// The validation sigil is an eye — observation. A validated ("observed") tree
// carries this badge across cards, detail views and the profile.
export const ValidationBadge = ({ className = '', compact = false }: ValidationBadgeProps) => {
  const stampSize = compact ? 'h-8 w-8' : 'h-12 w-12';
  const eyeSize = compact ? 18 : 26;

  return (
    <span
      title="Validated"
      aria-label="Validated"
      className={`relative inline-flex shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-900/30 ring-2 ring-white/70 ${stampSize} ${className}`}
    >
      <Icons.Eye size={eyeSize} />
    </span>
  );
};
