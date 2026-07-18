import { useState, useEffect, lazy, Suspense, Component, ErrorInfo } from "react";
import { useConfig } from "@/context/ConfigContext";
const PhotoCarousel = lazy(() => import("../carousel/PhotoCarousel"));
const FilmstripGallery = lazy(() => import("./FilmstripGallery"));

interface Photo {
  id?: string | number;
  src: string;
  alt: string;
  legend?: string;
}

interface DynamicGalleryProps {
  imageGlobPattern?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string | null;
}

class ErrorBoundary extends Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, errorMessage: null };
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, errorMessage: error.message };
  }
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Error in gallery component:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="loading-placeholder" role="alert">
          <p>Error loading gallery: {this.state.errorMessage || "Unknown error"}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

const DynamicGallery: React.FC<DynamicGalleryProps> = ({ imageGlobPattern }) => {
  const { appConfig, features } = useConfig();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadImages() {
      try {
        setIsLoading(true);
        const glob = imageGlobPattern || appConfig.imageGlob || "../../../assets/tss/*.{png,jpg,jpeg,svg,gif}";
        const modules = (import.meta.glob as (pattern: string, options: { eager: boolean }) => Record<string, () => Promise<{ default: string }>>)(
          "../../../assets/tss/*.{png,jpg,jpeg,svg,gif}",
          { eager: false }
        );
        if (Object.keys(modules).length === 0) {
          throw new Error(`No images found for pattern: ${glob}`);
        }
        const loadedPhotos: Photo[] = await Promise.all(
          Object.keys(modules).map(async (path, index) => {
            const module = await modules[path]();
            return {
              id: index,
              src: module.default,
              alt: `Gallery image ${index + 1}`,
            };
          })
        );
        setPhotos(loadedPhotos);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load images");
      } finally {
        setIsLoading(false);
      }
    }
    loadImages();
  }, [imageGlobPattern, appConfig.imageGlob]);

  const handleCarouselChange = (index: number) => setCurrentSlide(index);
  const handleThumbnailClick = (index: number) => setCurrentSlide(index);

  if (isLoading) {
    return (
      <div className="loading-placeholder" role="status">
        <p>Loading gallery...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="loading-placeholder" role="alert">
        <p>Error: {error}</p>
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <div className="loading-placeholder" role="status">
        <p>
          No images found for pattern: <code>{imageGlobPattern || "N/A"}</code>
        </p>
      </div>
    );
  }

  const galleryIdSuffix = imageGlobPattern ? imageGlobPattern.replace(/[^a-zA-Z0-9_]/g, "-") : `gallery-${appConfig.slug || "default"}`;

  return (
    <div className="carousel-container w-full max-w-none sm:max-w-lg md:max-w-3xl px-2 sm:px-4" id={`gallery-${galleryIdSuffix}`} role="region" aria-label="Photo gallery">
      <ErrorBoundary>
        <Suspense fallback={<div className="loading-placeholder"><p>Loading carousel...</p></div>}>
          <PhotoCarousel photosData={photos} selectedItem={currentSlide} onChange={handleCarouselChange} />
          {features?.filmstrip && (
            <FilmstripGallery photosData={photos} currentIndex={currentSlide} onThumbnailClick={handleThumbnailClick} />
          )}
        </Suspense>
      </ErrorBoundary>
    </div>
  );
};

export default DynamicGallery;