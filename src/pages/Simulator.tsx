import { useMemo, useState } from "react";
import TreeModal from "@/components/tree/TreeModal";
import PulsesPanel from "@/components/pulse/PulsesPanel";
import ConnectionsPanel from "@/components/forest/ConnectionsPanel";
import ChatPanel from "@/components/chat/ChatPanel";
import { useNavigate } from "react-router-dom";
import type { Connection, Pulse, Tree } from "@/types/Types";

export default function Simulator() {
  const navigate = useNavigate();

  // Mock initial data
  const [trees, setTrees] = useState<Tree[]>([
    { id: crypto.randomUUID(), kind: "mother", name: "Mother Tree 1", lat: 27.9881, lng: 86.9250, note: "Kailash", color: "#007bff" },
    { id: crypto.randomUUID(), kind: "lifetree", name: "Lifetree 1", lat: 45.4215, lng: -75.6993, note: "Ottawa", color: "#28a745" },
    { id: crypto.randomUUID(), kind: "guardian", name: "Guardian 1", lat: 48.8566, lng: 2.3522, note: "Paris", color: "#e67e22" },
  ]);
  const [pulses, setPulses] = useState<Pulse[]>([]);
  const [connections] = useState<Connection[]>([
    { id: crypto.randomUUID(), handle: "willow@lisbon", sinceISO: "2025-06-01T00:00:00Z" },
    { id: crypto.randomUUID(), handle: "algarve-oak@portugal", sinceISO: "2025-07-10T00:00:00Z" },
  ]);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);

  const addTree = (t: Tree) => {
    setTrees((ts) => [...ts, t]);
  };

  const addPulse = (text: string) => {
    setPulses((ps) => [...ps, { id: crypto.randomUUID(), text }]);
  };
  const deletePulse = (id: string) => {
    setPulses((ps) => ps.filter((p) => p.id !== id));
  };
  const attachPulse = (id: string) => {
    const firstTree = trees.find((t) => t.kind !== "mother");
    if (!firstTree) return;
    setPulses((ps) => ps.map((p) => (p.id === id ? { ...p, attachedTreeId: firstTree.id } : p)));
  };

  const onViewMatches = () => {
    navigate("/thetree");
  };

  const gridClasses = useMemo(
    () => "grid gap-4 p-4 grid-cols-1 md:grid-cols-[2fr_1fr]",
    []
  );

  return (
    <main className={`${gridClasses} bg-background text-foreground`}>
      <PulsesPanel
        pulses={pulses}
        onAdd={addPulse}
        onDelete={deletePulse}
        onAttach={attachPulse}
        onViewMatches={onViewMatches}
      />
      <ConnectionsPanel connections={connections} />
      <ChatPanel apiKey={import.meta.env.VITE_APP_XAI_API_KEY || ""} />
      <TreeModal open={modalOpen} onClose={() => setModalOpen(false)} onAdd={addTree} />
    </main>
  );
}