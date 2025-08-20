import React, { useRef } from "react";
import type { Pulse } from "../../types/Types";

export default function PulsesPanel({
  pulses, onAdd, onDelete, onAttach, onViewMatches
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
    <div className="card">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-base text-muted">Pulses</h2>
        <button className="btn" onClick={onViewMatches}>View Matches</button>
      </div>

      <div className="flex gap-2 mb-2">
        <input
          ref={inputRef}
          className="flex-1 bg-[#0f151b] border border-white/10 rounded-lg p-2"
          placeholder="Enter a pulse..."
          onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
        />
        <button className="btn btn-primary" onClick={handleAdd}>
          Add Pulse
        </button>
      </div>

      <ul>
        {pulses.map(p => (
          <li key={p.id} className="flex items-center justify-between border-t border-white/10 py-2">
            <span className="flex-1">
              {p.attachedTreeId && <span title="On the Tree" className="mr-1">🌳</span>}
              {p.text}
            </span>
            <div className="flex gap-2">
              {!p.attachedTreeId && (
                <button className="btn" onClick={() => onAttach(p.id)}>Attach</button>
              )}
              <button
                className="btn"
                disabled={!!p.attachedTreeId}
                onClick={() => { if (!p.attachedTreeId) onDelete(p.id); }}
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