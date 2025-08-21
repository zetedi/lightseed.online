import ThemeProvider from "../components/ThemeProvider";
import TextStrip from "../components/text-strip/TextStrip";
import DynamicGallery from "../components/gallery/DynamicGallery";

function Photography() {

  const PHOTOFOLDER = "../../../assets/photography/*.{png,jpg,jpeg,svg,gif}";

  return (
    <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
      <div className="relative h-auto overflow-x-hidden">
        <TextStrip title={``}>
          <div className="centered-holder">
            <DynamicGallery imageGlobPattern={PHOTOFOLDER} />
          </div>
        </TextStrip>
      </div>
    </ThemeProvider>
  );
}

export default Photography;
