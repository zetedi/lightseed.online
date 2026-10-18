import { useState } from 'react';
import { Picture } from './Picture';
import { FullViewButton } from './FullView';
import { aspectOf } from '../../domain/imageFit';

// THE GALLERY SEAT (ring 2026-10-05) — a record's many pictures shown as one: the chosen picture
// large, with a door to the full view, and — when there are several — a strip of thumbnails over
// its foot to choose from. The first picture opens (it is the record's face). One shell for an
// event, a pulse, an offering, a vision, a bed; before this, two of them drew it by hand.
// `fit` (ring 2026-10-18): 'cover' fills the seat's frame and cuts what overflows (a photo);
// 'contain' shows the picture WHOLE — the frame takes the picture's own aspect, capped in height,
// and the picture's blurred self fills whatever the cap leaves beside it (a flyer, a poster).
interface PictureGalleryProps {
  images: string[];
  alt?: string;
  // The frame's height and spacing, e.g. "mb-6 h-72" — the seat decides its own size.
  className?: string;
  // Eager when the gallery stands above the fold.
  eager?: boolean;
  // How the chosen picture meets the frame: cut to fill it (default), or shown whole.
  fit?: 'cover' | 'contain';
}

export const PictureGallery = ({ images, alt = '', className = 'mb-6 h-72', eager = false, fit = 'cover' }: PictureGalleryProps) => {
  // The chosen picture is remembered by URL, not by index: when the list changes under the
  // gallery (an edit, a re-ordering) a choice that still stands is kept, and otherwise the
  // first — the record's new face — is shown. An index would have pointed at whatever moved there.
  const [chosen, setChosen] = useState<string | null>(null);
  // Each picture's own aspect, learned as it loads — the frame of a whole picture follows it.
  const [aspects, setAspects] = useState<Record<string, number>>({});
  if (!images.length) return null;
  const shown = chosen && images.includes(chosen) ? chosen : images[0];
  const whole = fit === 'contain';
  const aspect = whole ? aspects[shown] : undefined;
  // A whole picture's frame: its own aspect, capped; the seat's height stands until it is known.
  const frame = whole ? `max-h-[32rem] ${aspect ? '' : 'h-72'}` : '';
  return (
    <div className={`group relative w-full overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:bg-slate-900 dark:border-slate-800 ${frame} ${className}`} style={aspect ? { aspectRatio: String(aspect) } : undefined}>
      {whole && <Picture src={shown} size={480} aria-hidden alt="" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-50 blur-2xl" />}
      <Picture
        src={shown} size={1200} loading={eager ? 'eager' : 'lazy'} alt={alt}
        className={`relative h-full w-full ${whole ? 'object-contain' : 'object-cover'}`}
        onLoad={whole ? (e) => {
          const a = aspectOf({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight });
          if (a && aspects[shown] !== a) setAspects(prev => ({ ...prev, [shown]: a }));
        } : undefined}
      />
      <FullViewButton src={shown} alt={alt} className="right-3 top-3" />
      {images.length > 1 && (
        <div className="absolute bottom-3 left-3 right-3 flex gap-2 overflow-x-auto rounded-2xl bg-black/30 p-2 backdrop-blur-md">
          {images.map((url, index) => (
            <button
              key={`${index}:${url}`}
              type="button"
              onClick={() => setChosen(url)}
              aria-pressed={shown === url}
              className={`h-12 w-12 shrink-0 overflow-hidden rounded-lg border-2 ${shown === url ? 'border-white' : 'border-white/30'}`}
            >
              <Picture src={url} className="h-full w-full object-cover" alt="" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
