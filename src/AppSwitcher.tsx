import { useConfig } from "@/context/ConfigContext";
import App from "./apps/App";
import ArtApp from "./apps/ArtApp";

export default function AppSwitcher() {
  const { appConfig } = useConfig();
  switch (appConfig.type) {
    case "lightseed":
      return <App />;
    case "art":
      return <ArtApp />;
    default:
      return (
        <div className="p-8 text-center">
          <h1 className="text-2xl font-semibold">{appConfig.title}</h1>
          <p className="opacity-70">App type "{appConfig.type}" has no dedicated UI yet.</p>
        </div>
      );
  }
}