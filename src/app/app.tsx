import { Routes, Route } from "react-router-dom";
import TheSecretSun from "@/app/thesecretsun";
import TheWhitePaper from "@/app/white";
import Photography from "@/app/photography";
import Phoenix from "@/app/phoenix";
import Yantra from "@/app/yantra";
import Home from "@/app/home";
import Layout from "@/app/layout";
import { ThemeProvider } from "@/components/theme-provider";
import { TailwindIndicator } from "@/components/tailwind-indicator";
import GlowBorder from "@/components/glow-border";

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
              </Route>
            </Routes>
          </div>
        </div>
        <TailwindIndicator />
      </ThemeProvider>
    </>
  );
}
