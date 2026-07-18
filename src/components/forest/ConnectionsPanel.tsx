import type { Connection } from "../../types/Types";

export default function ConnectionsPanel({ connections }: { connections: Connection[] }) {
  return (
    <div className="card bg-card border border-border p-3 rounded-2xl">
      <h2 className="text-base text-muted-foreground">Connections</h2>
      <ul className="mt-2">
        {connections.map((c) => (
          <li key={c.id} className="text-foreground text-light-fallback py-1">
            {c.handle} (since {new Date(c.sinceISO).toLocaleDateString()})
          </li>
        ))}
      </ul>
    </div>
  );
}