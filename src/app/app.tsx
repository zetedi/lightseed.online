import { Routes, Route } from "react-router-dom";
import TheSecretSun from "@/app/TheSecretSun";
import TheWhitePaper from "@/app/White";
import Photography from "@/app/Photography";
import Phoenix from "@/app/Phoenix";
import Yantra from "@/app/Yantra";
import Simulator from "@/app/Simulator";
import TheTree from "@/app/TheTree";
import Home from "@/app/Home";
import Layout from "@/app/Layout";
import ThemeProvider from "@/components/ThemeProvider";
import TailwindIndicator from "@/components/utils/TailwindIndicator";
import GlowBorder from "@/components/utils/layout/GlowBorder";

export default function App() {
  return (
    <>
      <ThemeProvider defaultTheme="system">
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
    </>
  );
}
