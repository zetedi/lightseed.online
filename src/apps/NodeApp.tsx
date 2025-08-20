import { useConfig } from "../context/ConfigContext";

export default function NodeApp() {
  const cfg = useConfig();
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{cfg.app.title}</h1>
        <div className="text-sm opacity-70">Network: {cfg.node?.chain.networkName}</div>
      </header>
      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl p-4 border border-white/10">
          <div className="text-sm opacity-70">API</div>
          <a className="text-lg underline" href={cfg.node?.apiBaseUrl}>
            {cfg.node?.apiBaseUrl}
          </a>
        </div>
        <div className="rounded-2xl p-4 border border-white/10">
          <div className="text-sm opacity-70">Explorer</div>
          <a className="text-lg underline" href={cfg.node?.chain.explorer}>
            {cfg.node?.chain.explorer}
          </a>
        </div>
      </section>
      {cfg.features.mastodonBridge && (
        <div className="mt-6 rounded-2xl p-4 border border-emerald-400/40">
          <div className="font-medium">Mastodon Bridge Enabled</div>
          <p className="opacity-80">Mentions will be processed by Lumeleto.</p>
        </div>
      )}
    </div>
  );
}