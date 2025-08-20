import { useConfig } from "./context/ConfigContext";
import App from "./apps/App";
import ArtApp from "./apps/ArtApp";
import NodeApp from "./apps/NodeApp";

export default function AppSwitcher() {
  const { app } = useConfig();
  switch (app.type) {
    case "lightseed":
      return <App />;
    case "art":
      return <ArtApp />;
    case "node":
      return <NodeApp />;
    default:
      return (
        <div className="p-8 text-center">
          <h1 className="text-2xl font-semibold">{app.title}</h1>
          <p className="opacity-70">App type "{app.type}" has no dedicated UI yet.</p>
        </div>
      );
  }
}