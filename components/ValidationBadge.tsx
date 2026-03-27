import React from 'react';

interface ValidationBadgeProps {
  className?: string;
  compact?: boolean;
}

export const ValidationBadge = ({ className = '', compact = false }: ValidationBadgeProps) => {
  const stampSize = compact ? 'h-12 w-12' : 'h-16 w-16';

  return (
    <span className={`relative inline-flex shrink-0 items-center justify-center ${stampSize} ${className}`}>
      <img src="/stamp.png" alt="Validated" className="h-full w-full object-contain drop-shadow-[0_8px_20px_rgba(111,29,27,0.28)]" />
    </span>
  );
};
