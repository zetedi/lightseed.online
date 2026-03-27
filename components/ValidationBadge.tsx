import React from 'react';
import Logo from './Logo';

interface ValidationBadgeProps {
  className?: string;
  compact?: boolean;
}

export const ValidationBadge = ({ className = '', compact = false }: ValidationBadgeProps) => {
  const size = compact ? 28 : 36;
  const textSize = compact ? 'text-[8px]' : 'text-[9px]';
  const vSize = compact ? 'text-sm' : 'text-lg';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white/95 px-2 py-1 shadow-sm backdrop-blur ${className}`}>
      <span className="relative shrink-0">
        <Logo
          width={size}
          height={size}
          backgroundFill="#d1fae5"
          strokeColor="#047857"
          seedFill="#ecfdf5"
        />
        <span className={`absolute inset-0 flex items-center justify-center font-black leading-none text-yellow-300 drop-shadow ${vSize}`}>V</span>
      </span>
      <span className={`font-bold uppercase tracking-[0.18em] text-emerald-700 ${textSize}`}>Validated</span>
    </span>
  );
};
