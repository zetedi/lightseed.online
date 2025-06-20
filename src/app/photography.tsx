import { ThemeProvider } from "../components/theme-provider";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "../components/ui/card";
import DynamicGallery from "../components/gallery/dynamic-gallery";

function Photography() {
  
  const PHOTOFOLDER = '../../../assets/photography/*.{png,jpg,jpeg,svg,gif}';

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <div>
        <div className="tree">
          <Card className="dark:bg-black light:text-black dark:text-white mx-auto p-6 border border-gray-300 shadow-lg rounded-lg">
            <CardHeader className="centered-holder p-2">
              <CardTitle className="centered-holder p-0 m-0">
                <p className="text-center md:text-4xl">
                  Photos
                </p>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <DynamicGallery imageGlobPattern={PHOTOFOLDER}/>
            </CardContent>
          </Card>
        </div>
      </div>
    </ThemeProvider>
  );
}

export default Photography;
