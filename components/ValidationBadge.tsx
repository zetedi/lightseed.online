import React from 'react';

interface ValidationBadgeProps {
  className?: string;
  compact?: boolean;
}

export const ValidationBadge = ({ className = '', compact = false }: ValidationBadgeProps) => {
  const stampSize = compact ? 'h-12 w-12' : 'h-16 w-16';
  const ringInset = compact ? 'inset-[4px]' : 'inset-[6px]';
  const checkSize = compact ? 'h-5 w-5' : 'h-7 w-7';
  const textSize = compact ? 'text-[6px]' : 'text-[8px]';

  return (
    <span className={`relative inline-flex shrink-0 items-center justify-center rounded-full border-2 border-[#6f1d1b] bg-[#fdf5f2]/95 text-[#6f1d1b] shadow-[0_8px_20px_rgba(111,29,27,0.28)] backdrop-blur ${stampSize} ${className}`}>
      <span className={`absolute ${ringInset} rounded-full border border-dashed border-[#8c2f2b]/80`} />
      <span className="absolute inset-0 rounded-full opacity-20" style={{ background: 'radial-gradient(circle, rgba(111,29,27,0.18) 0%, transparent 70%)' }} />
      <span className="relative flex flex-col items-center justify-center leading-none">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" className={`${checkSize}`}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13.2l4.1 4.1L19 7.8" />
        </svg>
        <span className={`mt-0.5 font-black uppercase tracking-[0.22em] ${textSize}`}>valid</span>
      </span>
    </span>
  );
};
