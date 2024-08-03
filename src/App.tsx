
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";
import Layout from "@/pages/Layout";
import TheSecretSun from "@/pages/TheSecretSun";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route path="thesecretsun" element={<TheSecretSun />} />
          <Route index element={<Home />} />
          <Route path="*" element={<Home />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}