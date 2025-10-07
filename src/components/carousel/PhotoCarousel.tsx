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
        className="carousel-container"
        role="alert"
        style={{
          padding: '20px',
          textAlign: 'center',
          border: '1px dashed #ccc',
          borderRadius: '8px',
          background: '#fff',
        }}
      >
        <p>No images to display in carousel.</p>
      </div>
    );
  }

  return (
    <div className="carousel-container" role="region" aria-label="Photo carousel">
      <Carousel
        showThumbs={false}
        showStatus={false}
        dynamicHeight={true}
        emulateTouch={true}
        selectedItem={selectedItem}
        onChange={onChange}
        useKeyboardArrows={true}
        showIndicators={false}
        ariaLabel="Photo carousel"
      >
        {photosData.map((photo, index) => (
          <div key={photo.id || index} role="group" aria-label={`Slide ${index + 1}`}>
            <img
              src={photo.src}
              alt={photo.alt}
              loading="lazy"
              style={{ maxWidth: '100%', height: 'auto' }}
            />
          </div>
        ))}
      </Carousel>
    </div>
  );
};

export default PhotoCarousel;