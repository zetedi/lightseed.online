import type { Connection } from "../../types/Types";

export default function ConnectionsPanel({ connections }: { connections: Connection[] }) {
  return (
    <div className="card">
      <h2 className="text-base text-muted mb-2">Connected Lifetrees</h2>
      <ul>
        {connections.map(c => (
          <li key={c.id} className="border-t border-white/10 py-2">
            @{c.handle} — since {new Date(c.sinceISO).toLocaleDateString()}
          </li>
        ))}
      </ul>
    </div>
  );
}
