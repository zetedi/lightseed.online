import React, { useState } from 'react';

// ONE carousel for every card (ring 2026-08-22): when a being carries several images, the
// card pages through them in place — arrows on hover, dots beneath, the card's own tap
// untouched (arrows stop propagation). A single image renders plain; the component is safe
// to wear everywhere a card shows its first picture.
export const CardCarousel = ({ images, alt = '', className = '', imgClassName = 'h-full w-full object-cover' }: {
  images: string[];
  alt?: string;
  className?: string;
  imgClassName?: string;
}) => {
  const [idx, setIdx] = useState(0);
  if (images.length === 0) return null;
  const i = Math.min(idx, images.length - 1);
  const step = (e: React.MouseEvent, d: number) => {
    e.stopPropagation();
    e.preventDefault();
    setIdx((i + d + images.length) % images.length);
  };
  return (
    <div className={`group/carousel relative h-full w-full ${className}`}>
      <img src={images[i]} alt={alt} className={imgClassName} />
      {images.length > 1 && (
        <>
          <button type="button" aria-label="previous image" onClick={(e) => step(e, -1)}
            className="absolute left-1 top-1/2 -translate-y-1/2 rounded-full bg-black/35 px-2 py-1 text-sm font-bold text-white opacity-0 backdrop-blur-sm transition-opacity hover:bg-black/55 group-hover/carousel:opacity-100">
            ‹
          </button>
          <button type="button" aria-label="next image" onClick={(e) => step(e, 1)}
            className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-black/35 px-2 py-1 text-sm font-bold text-white opacity-0 backdrop-blur-sm transition-opacity hover:bg-black/55 group-hover/carousel:opacity-100">
            ›
          </button>
          <div className="pointer-events-none absolute bottom-1.5 left-1/2 flex -translate-x-1/2 gap-1">
            {images.map((_, d) => (
              <span key={d} className={`h-1.5 w-1.5 rounded-full transition-colors ${d === i ? 'bg-white' : 'bg-white/45'}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
};
