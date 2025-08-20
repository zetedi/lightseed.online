import { useEffect, useRef, useState, useCallback } from 'react';

// Define the props interface for type safety (good practice in TypeScript)
interface FilmstripGalleryProps {
  photosData: Array<{
    id: string | number;
    src: string;
    alt?: string;
    legend?: string;
  }>;
  currentIndex: number;
  onThumbnailClick: (index: number) => void;
}

const FilmstripGallery: React.FC<FilmstripGalleryProps> = ({ photosData, currentIndex, onThumbnailClick }) => {
  // Specify the type of HTML element the ref will hold
  const filmstripRef = useRef<HTMLDivElement>(null);
  const activeThumbnailRef = useRef<HTMLDivElement>(null); // Assuming thumbnails are divs

  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);

  const SCROLL_AMOUNT = 200;

  const isScrollable = useCallback(() => {
    // Add null checks for filmstripRef.current before accessing properties
    if (!filmstripRef.current) return false;
    return filmstripRef.current.scrollWidth > filmstripRef.current.clientWidth + 5;
  }, []);

  const checkScrollButtons = useCallback(() => {
    // Add null checks
    if (!filmstripRef.current) {
      setShowLeftArrow(false);
      setShowRightArrow(false);
      return;
    }
    const { scrollLeft, scrollWidth, clientWidth } = filmstripRef.current;
    const canScroll = isScrollable(); // isScrollable already checks filmstripRef.current
    setShowLeftArrow(canScroll && scrollLeft > 5);
    setShowRightArrow(canScroll && scrollLeft < scrollWidth - clientWidth - 5);
  }, [isScrollable]);

  useEffect(() => {
    const handleInteractionOrResize = () => checkScrollButtons();
    
    // filmstripRef.current might be null on initial render before the div is mounted
    // Call checkScrollButtons only if/when it's available, or let checkScrollButtons handle the null check
    handleInteractionOrResize(); 

    window.addEventListener('resize', handleInteractionOrResize);
    const currentFilmstripNode = filmstripRef.current; // Capture current value for cleanup
    if (currentFilmstripNode) {
      currentFilmstripNode.addEventListener('scroll', handleInteractionOrResize);
    }
    return () => {
      window.removeEventListener('resize', handleInteractionOrResize);
      if (currentFilmstripNode) {
        currentFilmstripNode.removeEventListener('scroll', handleInteractionOrResize);
      }
    };
  }, [photosData, checkScrollButtons]); // photosData is not directly used in the effect callback,
                                       // but if it changes, the DOM might re-render, affecting scrollability.
                                       // So, keeping it can be safer.

  useEffect(() => {
    const scrollActiveAndRecheck = () => {
        // Add null checks
        if (activeThumbnailRef.current && filmstripRef.current) {
            const filmstripNode = filmstripRef.current; // Use consistent naming or just filmstripRef.current
            const activeThumbNode = activeThumbnailRef.current;

            const filmstripRect = filmstripNode.getBoundingClientRect();
            const activeThumbRect = activeThumbNode.getBoundingClientRect();
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
                filmstripNode.scrollBy({ left: scrollDistance, behavior: 'smooth' });
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

  const scrollFilmstrip = useCallback((direction: 'left' | 'right') => { // Typed direction
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

  let filmstripClasses = "filmstrip-gallery-container";
  if (!showLeftArrow) {
    filmstripClasses += " radius-left";
  }
  if (!showRightArrow) {
    filmstripClasses += " radius-right";
  }
  // isScrollable might access filmstripRef.current, ensure it's handled if called early
  // This logic is generally fine as it runs during render when filmstripRef should be about to be populated
  if (photosData.length > 0 && !isScrollable()) { 
    filmstripClasses += " radius-left radius-right";
  }

  return (
    <div className="filmstrip-outer-container min-w-0 w-full"> {/* Assuming these Tailwind classes are what you want */}
      {showLeftArrow && isScrollable() && (
        <button
          type="button"
          className="filmstrip-arrow left"
          onClick={() => scrollFilmstrip('left')}
          aria-label="Scroll filmstrip left"
        >
          &lt;
        </button>
      )}
      <div
        className={`${filmstripClasses} min-w-0`}
        ref={filmstripRef} // ref is attached to this div
      >
        {photosData.map((photo, index) => (
          <div // This is what activeThumbnailRef points to
            key={photo.id || index}
            ref={index === currentIndex ? activeThumbnailRef : null}
            className={`filmstrip-thumbnail ${index === currentIndex ? 'active' : ''}`}
            onClick={() => onThumbnailClick(index)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                onThumbnailClick(index);
              }
            }}
            aria-label={`View ${photo.legend || `image ${index + 1}`}`}
            aria-current={index === currentIndex ? 'true' : 'false'}
          >
            <img src={photo.src} alt={photo.alt || `Thumbnail ${index + 1}`} />
          </div>
        ))}
      </div>
      {showRightArrow && isScrollable() && (
        <button
          type="button"
          className="filmstrip-arrow right"
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