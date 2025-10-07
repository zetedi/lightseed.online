import { useRef } from "react";
import type { Pulse } from "../../types/Types";

export default function PulsesPanel({
  pulses,
  onAdd,
  onDelete,
  onAttach,
  onViewMatches,
}: {
  pulses: Pulse[];
  onAdd: (text: string) => void;
  onDelete: (id: string) => void;
  onAttach: (id: string) => void;
  onViewMatches: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleAdd = () => {
    const v = inputRef.current?.value?.trim();
    if (!v) return;
    onAdd(v);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="card bg-card border border-border p-3 rounded-2xl">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-base text-muted-foreground">Pulses</h2>
        <button
          className="btn text-foreground hover:border-accent"
          onClick={onViewMatches}
        >
          View Matches
        </button>
      </div>

      <div className="flex gap-2 mb-2">
        <input
          ref={inputRef}
          className="flex-1 bg-card border border-border rounded-lg p-2 text-foreground"
          placeholder="Enter a pulse..."
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAdd();
          }}
        />
        <button
          className="btn btn-primary text-primary-foreground"
          onClick={handleAdd}
        >
          Add Pulse
        </button>
      </div>

      <ul>
        {pulses.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between border-t border-border py-2"
          >
            <span className="flex-1 text-foreground text-light-fallback">
              {p.attachedTreeId && (
                <span title="On the Tree" className="mr-1">
                  🌳
                </span>
              )}
              {p.text}
            </span>
            <div className="flex gap-2">
              {!p.attachedTreeId && (
                <button
                  className="btn text-foreground hover:border-accent"
                  onClick={() => onAttach(p.id)}
                >
                  Attach
                </button>
              )}
              <button
                className="btn text-foreground hover:border-accent"
                disabled={!!p.attachedTreeId}
                onClick={() => {
                  if (!p.attachedTreeId) onDelete(p.id);
                }}
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}