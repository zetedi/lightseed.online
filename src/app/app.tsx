import { Routes, Route } from "react-router-dom";
import TheSecretSun from "@/app/thesecretsun";
import Home from "@/app/home";
import Layout from "@/app/layout";
import { ThemeProvider } from "@/components/theme-provider";
import { TailwindIndicator } from "@/components/tailwind-indicator";

export default function App() {
  return (
    <>
      <ThemeProvider defaultTheme="system">
        <div className="relative flex min-h-screen flex-col">
          <div className="flex-1">
            <Routes>
              <Route path="/" element={<Layout />}>
                <Route index element={<Home />} />
                <Route path="*" element={<hr />} />
                <Route path="thesecretsun" element={<TheSecretSun />} />
              </Route>
            </Routes>
          </div>
        </div>
        <TailwindIndicator />
      </ThemeProvider>
    </>
  );
}
