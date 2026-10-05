import { useState, type DragEvent } from 'react';
import { Icons } from './Icons';
import { ImagePicker } from './ImagePicker';
import { Picture } from './Picture';
import { useLanguage } from '../../contexts/LanguageContext';
import { moveItem, canMoveEarlier, canMoveLater } from '../../domain/order';

// THE STRIP OF PICTURES (ring 2026-10-05) — the one shell for a record's many pictures: an event's,
// an offering's, a gallery's. Each tile removes itself and MOVES — by its two arrows (every
// pointer, the keyboard, a thumb) or by dragging it onto another tile (a mouse). The order is the
// record's: `imageUrls` as saved, and the FIRST is the face the world sees (a card's `imageUrl`),
// so the first tile wears a small chip when the caller says the first is the cover. The law of a
// move is domain/order (moveItem); this component only draws and asks.
interface ImageStripProps {
  images: string[];
  // The whole next list — a removal or a move; the caller owns the state (and any release of a
  // picture that left, which it reads from the diff).
  onChange: (next: string[]) => void;
  // A new picture, through the picker (cropped, with the original beside it).
  onAdd?: (file: File, original: File) => void;
  uploading?: boolean;
  // Whether the first picture is the record's cover (events, offerings) — a chip and a hint say so.
  cover?: boolean;
  // Grid columns at the strip's widest.
  cols?: 3 | 4;
  alt?: (index: number) => string;
}

export const ImageStrip = ({ images, onChange, onAdd, uploading = false, cover = false, cols = 3, alt }: ImageStripProps) => {
  const { t } = useLanguage();
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);

  const move = (from: number, to: number) => {
    const next = moveItem(images, from, to);
    if (next !== images) onChange(next);
  };
  const remove = (index: number) => onChange(images.filter((_, i) => i !== index));

  const onDragStart = (index: number) => (e: DragEvent) => {
    setDragging(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index)); // some browsers start no drag without data
  };
  const onDragOver = (index: number) => (e: DragEvent) => {
    if (dragging === null) return;
    e.preventDefault(); // allow the drop
    e.dataTransfer.dropEffect = 'move';
    if (over !== index) setOver(index);
  };
  const onDrop = (index: number) => (e: DragEvent) => {
    e.preventDefault();
    if (dragging !== null) move(dragging, index);
    setDragging(null); setOver(null);
  };
  const onDragEnd = () => { setDragging(null); setOver(null); };

  const gridCols = cols === 4 ? 'grid-cols-3 sm:grid-cols-4' : 'grid-cols-3';
  const arrow = 'rounded-full bg-white/90 p-1 text-slate-600 shadow-sm transition-colors hover:text-emerald-700 disabled:opacity-30 disabled:hover:text-slate-600 dark:bg-slate-900/90 dark:text-slate-300';

  return (
    <div>
      <div className={`grid ${gridCols} gap-2`}>
        {images.map((url, index) => (
          <div
            key={url}
            draggable={images.length > 1}
            onDragStart={onDragStart(index)}
            onDragOver={onDragOver(index)}
            onDragEnter={onDragOver(index)}
            onDrop={onDrop(index)}
            onDragEnd={onDragEnd}
            className={`group relative aspect-square overflow-hidden rounded-xl border bg-slate-50 dark:bg-slate-900 ${
              over === index && dragging !== null && dragging !== index
                ? 'border-emerald-500 ring-2 ring-emerald-300'
                : 'border-slate-200 dark:border-slate-700'
            } ${dragging === index ? 'opacity-50' : ''} ${images.length > 1 ? 'cursor-grab active:cursor-grabbing' : ''}`}
          >
            <Picture size={480} src={url} className="pointer-events-none h-full w-full select-none object-cover" alt={alt ? alt(index) : ''} draggable={false} />
            {cover && index === 0 && (
              <span className="absolute left-1 top-1 rounded-full bg-emerald-600/90 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white shadow-sm">
                {t('image_cover')}
              </span>
            )}
            <button type="button" onClick={() => remove(index)} className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-red-500 shadow-sm dark:bg-slate-900/90" title={t('remove')} aria-label={t('remove')}>
              <Icons.Close />
            </button>
            {images.length > 1 && (
              <div className="absolute inset-x-1 bottom-1 flex items-center justify-between">
                <button type="button" onClick={() => move(index, index - 1)} disabled={!canMoveEarlier(index)} className={arrow} title={t('image_move_earlier')} aria-label={t('image_move_earlier')}>
                  <Icons.ChevronRight size={14} className="rotate-180 rtl:rotate-0" />
                </button>
                <button type="button" onClick={() => move(index, index + 1)} disabled={!canMoveLater(index, images.length)} className={arrow} title={t('image_move_later')} aria-label={t('image_move_later')}>
                  <Icons.ChevronRight size={14} className="rtl:rotate-180" />
                </button>
              </div>
            )}
          </div>
        ))}
        {onAdd && (
          <ImagePicker onImageSelect={onAdd} loading={uploading} className="flex aspect-square cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-white text-slate-400 hover:border-emerald-400 hover:text-emerald-600 dark:bg-slate-900 dark:border-slate-700">
            <Icons.Plus />
          </ImagePicker>
        )}
      </div>
      {images.length > 1 && (
        <p className="mt-1.5 text-[11px] text-slate-400">{cover ? t('images_order_hint') : t('images_order_hint_gallery')}</p>
      )}
    </div>
  );
};
