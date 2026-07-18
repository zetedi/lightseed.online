import { useEffect, useRef, useState, useCallback } from 'react';

interface Photo {
  id?: string | number;
  src: string;
  alt: string;
  legend?: string;
}

interface FilmstripGalleryProps {
  photosData: Photo[];
  currentIndex: number;
  onThumbnailClick: (index: number) => void;
}

const FilmstripGallery: React.FC<FilmstripGalleryProps> = ({ photosData, currentIndex, onThumbnailClick }) => {
  const filmstripRef = useRef<HTMLDivElement>(null);
  const activeThumbnailRef = useRef<HTMLButtonElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);
  const SCROLL_AMOUNT = 150;

  const isScrollable = useCallback(() => {
    if (!filmstripRef.current) return false;
    return filmstripRef.current.scrollWidth > filmstripRef.current.clientWidth + 5;
  }, []);

  const checkScrollButtons = useCallback(() => {
    if (!filmstripRef.current) {
      setShowLeftArrow(false);
      setShowRightArrow(false);
      return;
    }
    const { scrollLeft, scrollWidth, clientWidth } = filmstripRef.current;
    const canScroll = isScrollable();
    setShowLeftArrow(canScroll && scrollLeft > 5);
    setShowRightArrow(canScroll && scrollLeft < scrollWidth - clientWidth - 5);
  }, [isScrollable]);

  useEffect(() => {
    const handleInteractionOrResize = () => checkScrollButtons();
    handleInteractionOrResize();
    window.addEventListener('resize', handleInteractionOrResize);
    const currentFilmstripNode = filmstripRef.current;
    if (currentFilmstripNode) {
      currentFilmstripNode.addEventListener('scroll', handleInteractionOrResize);
    }
    return () => {
      window.removeEventListener('resize', handleInteractionOrResize);
      if (currentFilmstripNode) {
        currentFilmstripNode.removeEventListener('scroll', handleInteractionOrResize);
      }
    };
  }, [photosData, checkScrollButtons]);

  useEffect(() => {
    const scrollActiveAndRecheck = () => {
      if (activeThumbnailRef.current && filmstripRef.current) {
        const filmstripRect = filmstripRef.current.getBoundingClientRect();
        const activeThumbRect = activeThumbnailRef.current.getBoundingClientRect();
        let scrollNeeded = false;
        let scrollDistance = 0;
        if (activeThumbRect.right > filmstripRect.right - 5) {
          scrollDistance = activeThumbRect.right - filmstripRect.right + 15;
          scrollNeeded = true;
        } else if (activeThumbRect.left < filmstripRect.left + 5) {
          scrollDistance = activeThumbRect.left - filmstripRect.left - 15;
          scrollNeeded = true;
        }
        if (scrollNeeded) {
          filmstripRef.current.scrollBy({ left: scrollDistance, behavior: 'smooth' });
          setTimeout(checkScrollButtons, 350);
        } else {
          checkScrollButtons();
        }
      } else {
        checkScrollButtons();
      }
    };
    scrollActiveAndRecheck();
  }, [currentIndex, photosData, checkScrollButtons]);

  const scrollFilmstrip = useCallback((direction: 'left' | 'right') => {
    if (filmstripRef.current) {
      filmstripRef.current.scrollBy({
        left: direction === 'left' ? -SCROLL_AMOUNT : SCROLL_AMOUNT,
        behavior: 'smooth',
      });
      setTimeout(checkScrollButtons, 350);
    }
  }, [checkScrollButtons]);

  if (!photosData || photosData.length === 0) {
    return null;
  }

  return (
    <div className="relative w-[90%] mx-auto sm:w-[80%] md:w-[70%] px-1 sm:px-2 md:px-4 py-2" role="navigation" aria-label="Thumbnail navigation">
      {showLeftArrow && isScrollable() && (
        <button
          type="button"
          className="filmstrip-arrow left absolute left-0 top-1/2 transform -translate-y-1/2 bg-background/80 border border-[var(--accent-color)] text-foreground rounded-full w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center hover:bg-accent z-10"
          onClick={() => scrollFilmstrip('left')}
          aria-label="Scroll filmstrip left"
        >
          &lt;
        </button>
      )}
      <div
        className="flex overflow-x-auto gap-1 sm:gap-2"
        ref={filmstripRef}
      >
        {photosData.map((photo, index) => (
          <button
            key={photo.id || index}
            ref={index === currentIndex ? activeThumbnailRef : null}
            className={`flex-shrink-0 w-14 h-14 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-md overflow-hidden border-2 ${
              currentIndex === index ? 'border-[var(--accent-color)]' : 'border-transparent'
            }`}
            onClick={() => onThumbnailClick(index)}
            aria-label={`Select image ${index + 1}`}
            aria-current={currentIndex === index}
          >
            <img
              src={photo.src}
              alt={photo.alt}
              loading="lazy"
              className="w-full h-full object-cover"
            />
          </button>
        ))}
      </div>
      {showRightArrow && isScrollable() && (
        <button
          type="button"
          className="filmstrip-arrow right absolute right-0 top-1/2 transform -translate-y-1/2 bg-background/80 border border-[var(--accent-color)] text-foreground rounded-full w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center hover:bg-accent z-10"
          onClick={() => scrollFilmstrip('right')}
          aria-label="Scroll filmstrip right"
        >
          &gt;
        </button>
      )}
    </div>
  );
};

export default FilmstripGallery;