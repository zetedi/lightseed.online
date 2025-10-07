import { lazy, Suspense } from 'react';
import { Carousel } from 'react-responsive-carousel';
import 'react-responsive-carousel/lib/styles/carousel.min.css';

interface Photo {
  id?: string | number;
  src: string;
  alt: string;
  legend?: string;
}

interface PhotoCarouselProps {
  photosData: Photo[] | null;
  selectedItem: number;
  onChange: (index: number, item: React.ReactNode) => void;
}

const PhotoCarousel: React.FC<PhotoCarouselProps> = ({ photosData, selectedItem, onChange }) => {
  if (!photosData || photosData.length === 0) {
    return (
      <div
        className="carousel-container w-full max-w-none sm:max-w-lg md:max-w-3xl px-2 sm:px-4"
        role="alert"
        style={{
          padding: '20px',
          textAlign: 'center',
          border: '1px dashed #ccc',
          borderRadius: '8px',
          background: 'hsl(var(--background))',
        }}
      >
        <p>No images to display in carousel.</p>
      </div>
    );
  }

  return (
    <div className="carousel-container w-full max-w-none sm:max-w-lg md:max-w-3xl px-2 sm:px-4" role="region" aria-label="Photo carousel">
      <Carousel
        showThumbs={false}
        showStatus={false}
        dynamicHeight={false}
        emulateTouch={true}
        selectedItem={selectedItem}
        onChange={onChange}
        useKeyboardArrows={true}
        showIndicators={false}
        ariaLabel="Photo carousel"
        className="w-full"
      >
        {photosData.map((photo, index) => (
          <div key={photo.id || index} role="group" aria-label={`Slide ${index + 1}`}>
            <img
              src={photo.src}
              alt={photo.alt}
              loading="lazy"
              className="w-full h-auto max-h-[60vh] object-contain"
            />
          </div>
        ))}
      </Carousel>
    </div>
  );
};

export default PhotoCarousel;