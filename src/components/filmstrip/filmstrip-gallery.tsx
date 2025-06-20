// src/components/FilmstripGallery.js
import React, { useEffect, useRef, useState, useCallback } from 'react'; // Added useCallback

const FilmstripGallery = ({ photosData, currentIndex, onThumbnailClick }) => {
  const filmstripRef = useRef(null);
  const activeThumbnailRef = useRef(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);

  const SCROLL_AMOUNT = 200;

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
    const currentFilmstrip = filmstripRef.current;
    if (currentFilmstrip) {
      currentFilmstrip.addEventListener('scroll', handleInteractionOrResize);
    }
    return () => {
      window.removeEventListener('resize', handleInteractionOrResize);
      if (currentFilmstrip) {
        currentFilmstrip.removeEventListener('scroll', handleInteractionOrResize);
      }
    };
  }, [photosData, checkScrollButtons]);

  useEffect(() => {
    const scrollActiveAndRecheck = () => {
        if (activeThumbnailRef.current && filmstripRef.current) {
            const filmstrip = filmstripRef.current;
            const activeThumb = activeThumbnailRef.current;
            const filmstripRect = filmstrip.getBoundingClientRect();
            const activeThumbRect = activeThumb.getBoundingClientRect();
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
                filmstrip.scrollBy({ left: scrollDistance, behavior: 'smooth' });
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

  const scrollFilmstrip = useCallback((direction) => {
    if (filmstripRef.current) {
      filmstripRef.current.scrollBy({
        left: direction === 'left' ? -SCROLL_AMOUNT : SCROLL_AMOUNT,
        behavior: 'smooth',
      });
      setTimeout(checkScrollButtons, 350);
    }
  }, [checkScrollButtons]);
  // ---- END: Re-inserted core logic ----


  if (!photosData || photosData.length === 0) {
    return null;
  }

  // Determine dynamic classes for border radius
  let filmstripClasses = "filmstrip-gallery-container";
  if (!showLeftArrow) {
    filmstripClasses += " radius-left";
  }
  if (!showRightArrow) {
    filmstripClasses += " radius-right";
  }
  if (!isScrollable() && photosData.length > 0) { // If not scrollable at all, both ends should be rounded
    filmstripClasses += " radius-left radius-right";
  }


  return (
    <div className="filmstrip-outer-container">
      {showLeftArrow && isScrollable() && ( // Added isScrollable() check here too for explicitness
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
        className={`${filmstripClasses} min-w-0`} // Use the dynamic classes
        ref={filmstripRef}
      >
        {photosData.map((photo, index) => (
          <div
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
      {showRightArrow && isScrollable() && ( // Added isScrollable() check here too
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