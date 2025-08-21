import { Carousel } from 'react-responsive-carousel';
import 'react-responsive-carousel/lib/styles/carousel.min.css';

// Define the shape of a single photo object
interface Photo {
  id?: string | number; // Optional, as you use `photo.id || index`
  src: string;
  alt: string;
  legend?: string; // Optional, as it's commented out but may be used later
}

// Define props for PhotoCarousel
interface PhotoCarouselProps {
  photosData: Photo[] | null; // Allow null to match your check
  selectedItem: number;
  onChange: (index: number, item: React.ReactNode) => void; // Type from react-responsive-carousel
}

const PhotoCarousel: React.FC<PhotoCarouselProps> = ({ photosData, selectedItem, onChange }) => {
  if (!photosData || photosData.length === 0) {
    return (
      <div
        className="carousel-container"
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
    <div className="carousel-container">
      <Carousel
        // autoPlay
        // infiniteLoop
        showThumbs={false}
        showStatus={false}
        dynamicHeight={true}
        emulateTouch={true}
        selectedItem={selectedItem}
        onChange={onChange}
        useKeyboardArrows={true}
        // showIndicators={false} // <--- ADD THIS TO HIDE DOTS
      >
        {photosData.map((photo, index) => (
          <div key={photo.id || index}>
            <img src={photo.src} alt={photo.alt} />
            {/* <p className="legend">{photo.legend}</p> */}
          </div>
        ))}
      </Carousel>
    </div>
  );
};

export default PhotoCarousel;