import React, { useState, useEffect, useMemo } from 'react';
import PhotoCarousel from "../carousel/photo-carousel.jsx"; // Adjust path if needed
import FilmstripGallery from "../filmstrip/filmstrip-gallery.jsx"; // Adjust path if needed

// Helper function to process image modules (can be outside the component or memoized inside)
const processImageModules = (imageModules) => {
  const photos = Object.entries(imageModules).map(([path, module]) => {
    const src = module.default;
    const filenameWithExtension = path.substring(path.lastIndexOf('/') + 1);
    let name = filenameWithExtension.replace(/\.(png|jpe?g|svg|gif)$/, '');
    name = name.replace(/[-_]/g, ' ');
    const legend = name.charAt(0).toUpperCase() + name.slice(1);

    return {
      src: src,
      legend: legend || `Image`, // Simplified default
      alt: legend || `Display image`, // Simplified default
      id: path,
    };
  });

  // Sort images by filename
  photos.sort((a, b) => {
    // Extract filename without extension for sorting
    const getSortableName = (item) => item.id.substring(item.id.lastIndexOf('/') + 1).replace(/\.(png|jpe?g|svg|gif)$/, '');
    const nameA = getSortableName(a);
    const nameB = getSortableName(b);
    const numA = parseInt(nameA.match(/\d+/)?.[0] || '0', 10);
    const numB = parseInt(nameB.match(/\d+/)?.[0] || '0', 10);

    if (numA && numB && numA !== numB) {
      return numA - numB;
    }
    return nameA.localeCompare(nameB);
  });
  return photos;
};

function DynamicGallery({ imageGlobPattern }) {
  const [photos, setPhotos] = useState([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Memoize the loaded image modules to prevent re-globbing on every render
  // This assumes imageGlobPattern doesn't change frequently.
  // If it does, this specific useMemo might need adjustment or the globbing moved to useEffect.
  const imageModules = useMemo(() => {
    if (!imageGlobPattern) return {};
    try {
      // Vite's import.meta.glob needs a static string literal for the glob pattern.
      // It cannot be a dynamic variable directly unless handled with more advanced techniques
      // or if the number of possible patterns is limited and known at build time.
      // For this example, we'll assume imageGlobPattern is one of a few predefined strings
      // or we'll address this limitation.

      // --- IMPORTANT LIMITATION & WORKAROUND ---
      // import.meta.glob patterns MUST be statically analyzable by Vite.
      // This means you can't just pass an arbitrary string like `props.imageGlobPattern`.
      //
      // Workaround 1: If you have a fixed set of known folders:
      if (imageGlobPattern === '../../../assets/photography/*.{png,jpg,jpeg,svg,gif}') {
        return import.meta.glob('../../../assets/photography/*.{png,jpg,jpeg,svg,gif}', { eager: true });
      }
      if (imageGlobPattern === '../../../assets/another-gallery/*.{png,jpg,jpeg,svg,gif}') {
        return import.meta.glob('../../../assets/another-gallery/*.{png,jpg,jpeg,svg,gif}', { eager: true });
      }
      // Add more known patterns here
      //
      // Workaround 2 (More dynamic but complex):
      // You might need to pass the already globbed modules as a prop,
      // or use a build step to generate a manifest.
      // For now, we'll proceed with the limitation of known patterns.
      //
      // If no known pattern matches, return empty or throw error.
      console.warn(`DynamicGallery: Unknown or unhandled imageGlobPattern: ${imageGlobPattern}. Image loading might fail.`);
      return {};

    } catch (e) {
      console.error("Error during import.meta.glob:", e);
      setError("Failed to initialize image loading.");
      return {};
    }
  }, [imageGlobPattern]);


  useEffect(() => {
    if (Object.keys(imageModules).length > 0) {
      try {
        const loadedPhotosData = processImageModules(imageModules);
        setPhotos(loadedPhotosData);
        setIsLoading(false);
        setError(null);
      } catch (e) {
        console.error("Error processing image modules:", e);
        setError("Failed to process images.");
        setIsLoading(false);
      }
    } else if (imageGlobPattern) { // If pattern was provided but modules are empty (e.g., due to glob limitation)
        setIsLoading(false); // Stop loading, will show "no images found"
        if (!error) setError("No image modules loaded for the provided pattern. Check pattern or glob limitations.");
    } else {
        setIsLoading(false); // No pattern provided
    }
  }, [imageModules, imageGlobPattern, error]); // Add error to dependency to avoid loop if error is set

  const handleThumbnailClick = (index) => {
    setCurrentSlide(index);
  };

  const handleCarouselChange = (index) => {
    setCurrentSlide(index);
  };

  if (isLoading) {
    return <div className="loading-placeholder"><p>Loading gallery...</p></div>;
  }

  if (error) {
    return <div className="loading-placeholder"><p>Error: {error}</p></div>;
  }

  if (photos.length === 0) {
    return (
      <div className="loading-placeholder">
        <p>
          No images found for pattern: <code>{imageGlobPattern || "N/A"}</code>
        </p>
      </div>
    );
  }

  return (
    // You might want to make the wrapper div's classes configurable via props too
    <div className="w-full mx-auto max-w-3xl px-2 sm:px-4" id={`gallery-${imageGlobPattern?.replace(/[^a-zA-Z0-9]/g, '-') || 'default'}`}>
      <PhotoCarousel
        photosData={photos}
        selectedItem={currentSlide}
        onChange={handleCarouselChange}
      />
      <FilmstripGallery
        photosData={photos}
        currentIndex={currentSlide}
        onThumbnailClick={handleThumbnailClick}
      />
    </div>
  );
}

export default DynamicGallery;