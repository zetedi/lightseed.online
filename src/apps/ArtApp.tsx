import { Routes, Route } from "react-router-dom";
import Photography from "@/pages/Photography";
import Layout from "@/pages/Layout";
import ThemeProvider from "@/components/ThemeProvider";
import TailwindIndicator from "@/components/utils/TailwindIndicator";

export default function ArtApp() {
  return (
    <>
      <ThemeProvider defaultTheme="light">
        <div className="relative flex min-h-screen flex-col">
          <div className="flex-1">
            <Routes>
              <Route path="/" element={<Layout />}>
                <Route index element={<Photography />} />
              </Route>
            </Routes>
          </div>
        </div>
        <TailwindIndicator />
      </ThemeProvider>
    </>
  );
}
