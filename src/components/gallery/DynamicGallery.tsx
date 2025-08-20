// src/components/gallery/dynamic-gallery.tsx

// Removed 'React' if not explicitly used (new JSX transform)
import { useState, useEffect, useMemo } from 'react';
import PhotoCarousel from "../carousel/PhotoCarousel.js"; // Assuming these are still .jsx, rename to .tsx if they also use TS
import FilmstripGallery from "../filmstrip/FilmstripGallery.js"; // Or .tsx

// --- Type Definitions ---
interface ImageModule {
  default: string; // The URL of the image
  // Add other properties if your globbed modules have them
}

interface Photo {
  src: string;
  legend: string;
  alt: string;
  id: string;
}

interface DynamicGalleryProps {
  imageGlobPattern?: string; // Make it optional if it can be undefined
}

// --- Helper Function ---
// Type the parameters and return value of the helper
const processImageModules = (imageModules: Record<string, ImageModule>): Photo[] => {
  const photos: Photo[] = Object.entries(imageModules).map(([path, module]) => {
    // 'module' is now typed as ImageModule, so module.default is known
    const src = module.default;
    const filenameWithExtension = path.substring(path.lastIndexOf('/') + 1);
    let name = filenameWithExtension.replace(/\.(png|jpe?g|svg|gif)$/, '');
    name = name.replace(/[-_]/g, ' ');
    const legend = name.charAt(0).toUpperCase() + name.slice(1) || `Image ${path}`; // Ensure legend has a fallback

    return {
      src: src,
      legend: legend,
      alt: legend, // Use legend as alt for simplicity, or generate more descriptive alt
      id: path,
    };
  });

  photos.sort((a, b) => {
    const getSortableName = (item: Photo) => item.id.substring(item.id.lastIndexOf('/') + 1).replace(/\.(png|jpe?g|svg|gif)$/, '');
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


const DynamicGallery: React.FC<DynamicGalleryProps> = ({ imageGlobPattern }) => {
  // Provide types for useState
  const [photos, setPhotos] = useState<Photo[]>([]); // Array of Photo objects
  const [currentSlide, setCurrentSlide] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null); // Can be string or null

  const imageModules: Record<string, ImageModule> = useMemo(() => {
    if (!imageGlobPattern) return {};
    try {
      // --- IMPORTANT LIMITATION & WORKAROUND ---
      // Vite's import.meta.glob needs a static string literal.
      // This part of the logic remains the same, but ensure paths are correct.
      if (imageGlobPattern === '../../../assets/photography/*.{png,jpg,jpeg,svg,gif}') {
        return import.meta.glob('../../../assets/photography/*.{png,jpg,jpeg,svg,gif}', { eager: true }) as Record<string, ImageModule>;
      }
      if (imageGlobPattern === '../../../assets/tss/*.{png,jpg,jpeg,svg,gif}') {
        return import.meta.glob('../../../assets/tss/*.{png,jpg,jpeg,svg,gif}', { eager: true }) as Record<string, ImageModule>;
      }
      // Add more known patterns here

      console.warn(`DynamicGallery: Unknown or unhandled imageGlobPattern: ${imageGlobPattern}. Image loading might fail.`);
      return {};
    } catch (e) {
      console.error("Error during import.meta.glob:", e);
      setError("Failed to initialize image loading."); // Now type-compatible
      return {};
    }
  }, [imageGlobPattern]);


  useEffect(() => {
    // Make sure imageModules is not just an empty object from a failed pattern match before processing
    if (imageModules && Object.keys(imageModules).length > 0) {
      try {
        const loadedPhotosData = processImageModules(imageModules);
        setPhotos(loadedPhotosData); // Now type-compatible
        setIsLoading(false);
        setError(null); // Type-compatible
      } catch (e) {
        console.error("Error processing image modules:", e);
        setError("Failed to process images."); // Type-compatible
        setIsLoading(false);
      }
    } else if (imageGlobPattern && !error) { // Only set error if not already set, to avoid loops if error is in dependency array
        setIsLoading(false);
        setError("No image modules loaded for the provided pattern. Check pattern or glob limitations."); // Type-compatible
    } else if (!imageGlobPattern) { // No pattern provided initially
        setIsLoading(false);
    }
  }, [imageModules, imageGlobPattern, error]);


  const handleThumbnailClick = (index: number) => { // Typed index
    setCurrentSlide(index);
  };

  const handleCarouselChange = (index: number) => { // Typed index
    setCurrentSlide(index);
  };

  if (isLoading) {
    return <div className="loading-placeholder"><p>Loading gallery...</p></div>;
  }

  if (error) {
    // Added a key here for stability if error message changes
    return <div className="loading-placeholder" key="error"><p>Error: {error}</p></div>;
  }

  if (photos.length === 0) {
    return (
      <div className="loading-placeholder" key="no-photos">
        <p>
          No images found for pattern: <code>{imageGlobPattern || "N/A"}</code>
        </p>
      </div>
    );
  }

  // Generate a more stable ID for the gallery wrapper
  const galleryIdSuffix = imageGlobPattern ? imageGlobPattern.replace(/[^a-zA-Z0-9_]/g, '-') : 'default-gallery';

  return (
    <div className="w-full mx-auto max-w-3xl px-2 sm:px-4" id={`gallery-${galleryIdSuffix}`}>
      <PhotoCarousel
        photosData={photos} // photos is Photo[]
        selectedItem={currentSlide}
        onChange={handleCarouselChange}
      />
      <FilmstripGallery
        photosData={photos} // photos is Photo[]
        currentIndex={currentSlide}
        onThumbnailClick={handleThumbnailClick}
      />
    </div>
  );
}

export default DynamicGallery;