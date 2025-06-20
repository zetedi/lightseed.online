// src/components/PhotoCarousel.js
import React from 'react';
import { Carousel } from 'react-responsive-carousel';
import "react-responsive-carousel/lib/styles/carousel.min.css";

const PhotoCarousel = ({ photosData, selectedItem, onChange }) => {
  if (!photosData || photosData.length === 0) {
    return (
        <div className="carousel-container" style={{ padding: '20px', textAlign: 'center', border: '1px dashed #ccc', borderRadius: '8px', background: '#fff' }}>
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