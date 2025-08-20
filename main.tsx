import React from "react";
import ReactDOM from "react-dom/client";
import { loadConfig } from "./src/lib/loadConfig";
import { BrowserRouter } from "react-router-dom";
import { ConfigProvider } from "./src/context/ConfigContext";
import AppSwitcher from "./src/AppSwitcher";
import "./index.css";
import "leaflet/dist/leaflet.css";

async function bootstrap() {
  const cfg = await loadConfig();
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <ConfigProvider cfg={cfg}>
        <BrowserRouter>
          <AppSwitcher />
        </BrowserRouter>
      </ConfigProvider>
    </React.StrictMode>
  );
}

bootstrap();