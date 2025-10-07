import { Routes, Route } from "react-router-dom";
import TheSecretSun from "@/pages/TheSecretSun";
import TheWhitePaper from "@/pages/White";
import Photography from "@/pages/Photography";
import Phoenix from "@/pages/Phoenix";
import Simulator from "@/pages/Simulator";
import TheTree from "@/pages/TheTree";
import Home from "@/pages/Home";
import Layout from "@/pages/Layout";
import ThemeProvider from "@/components/ThemeProvider";
import TailwindIndicator from "@/components/utils/TailwindIndicator";
import GlowBorder from "@/components/utils/layout/GlowBorder";
import Yantra from "@/pages/Yantra";

export default function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <GlowBorder />
      <div className="relative flex min-h-screen flex-col">
        <div className="flex-1">
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="*" element={<hr />} />
              <Route path="thesecretsun" element={<TheSecretSun />} />
              <Route path="white" element={<TheWhitePaper />} />
              <Route path="phoenix" element={<Phoenix />} />
              <Route path="photos" element={<Photography />} />
              <Route path="yantra" element={<Yantra />} />
              <Route path="simulator" element={<Simulator />} />
              <Route path="thetree" element={<TheTree />} />
            </Route>
          </Routes>
        </div>
      </div>
      <TailwindIndicator />
    </ThemeProvider>
  );
}