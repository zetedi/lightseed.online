import { ThemeProvider } from "../components/theme-provider";
import { useParallaxScroll } from "../hooks/useParallaxScroll";
import TextStrip from "../components/text-strip/text-strip";
import DynamicGallery from "../components/gallery/dynamic-gallery";

const Spacer = ({ height }: { height: string }) => <div style={{ height }} />;

function Photography() {
  const offsetY = useParallaxScroll();
  const parallaxFactor = 0.3;

  const PHOTOFOLDER = "../../../assets/photography/*.{png,jpg,jpeg,svg,gif}";

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <div className="relative h-auto overflow-x-hidden">
        {/* BACKGROUND LAYER */}
        <div
          className="fixed top-0 left-0 w-full h-[150vh] bg-cover bg-center -z-10"
          style={{
            backgroundImage: `url('/trees/phoenix.jpg')`,
            transform: `translateY(-${offsetY * parallaxFactor}px)`,
          }}
        />

        <Spacer height="3vh" />

        <TextStrip title={`Images`}>
          <div className="centered-holder">
            <DynamicGallery imageGlobPattern={PHOTOFOLDER} />
          </div>
        </TextStrip>
      </div>
    </ThemeProvider>
  );
}

export default Photography;
