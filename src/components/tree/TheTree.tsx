// src/components/Matches.tsx
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

type Pulse = {
  id: string;
  text: string;
  createdAtISO: string;
  by: string;      // your handle
};

type Match = {
  id: string;
  score: number;   // 0..1
  kind: "lifetree" | "mother" | "guardian";
  partner: {
    id: string;
    handle: string;
    location?: string;
    avatar?: string;
  };
  pulse: Pulse;    // your pulse it matched on
  partnerPulsePreview?: string;
  status: "new" | "reviewed" | "accepted" | "rejected" | "committed";
  notes?: string;
};

function scoreColor(score: number) {
  if (score >= 0.85) return "text-green-400";
  if (score >= 0.65) return "text-yellow-300";
  return "text-orange-300";
}

export default function TheTree() {
  const navigate = useNavigate();

  // --- Mock data (replace with real API later) ---
  const [matches, setMatches] = useState<Match[]>([
    {
      id: crypto.randomUUID(),
      score: 0.89,
      kind: "lifetree",
      partner: { id: "t1", handle: "willow@lisbon", location: "Lisbon" },
      pulse: {
        id: "p1",
        text: "Host a Lifetree workshop for 12 people in Lisbon in September",
        createdAtISO: "2025-08-10T12:00:00Z",
        by: "you@lightseed",
      },
      partnerPulsePreview:
        "Looking to collaborate on a small Lisbon gathering; can provide venue & tea.",
      status: "new",
    },
    {
      id: crypto.randomUUID(),
      score: 0.73,
      kind: "guardian",
      partner: { id: "t2", handle: "cedar@ottawa", location: "Ottawa" },
      pulse: {
        id: "p2",
        text: "Create a story-archive node for guardians with photos and rituals",
        createdAtISO: "2025-08-11T10:30:00Z",
        by: "you@lightseed",
      },
      partnerPulsePreview:
        "We’re building a small ritual archive; seeking cross-node schema.",
      status: "reviewed",
    },
    {
      id: crypto.randomUUID(),
      score: 0.61,
      kind: "mother",
      partner: { id: "t3", handle: "oak@algarve", location: "Algarve" },
      pulse: {
        id: "p3",
        text: "Share seeds with southern nodes; need shipping coordination",
        createdAtISO: "2025-08-12T09:00:00Z",
        by: "you@lightseed",
      },
      partnerPulsePreview:
        "Have surplus native seeds; can ship monthly; need addresses.",
      status: "reviewed",
    },
  ]);

  const [activeId, setActiveId] = useState(matches[0]?.id);
  const active = useMemo(
    () => matches.find((m) => m.id === activeId),
    [matches, activeId]
  );

  // --- Actions (mocked) ---
  const markReviewed = (id: string) =>
    setMatches((xs) => xs.map((m) => (m.id === id ? { ...m, status: "reviewed" } : m)));

  const accept = (id: string) =>
    setMatches((xs) => xs.map((m) => (m.id === id ? { ...m, status: "accepted" } : m)));

  const reject = (id: string) =>
    setMatches((xs) => xs.map((m) => (m.id === id ? { ...m, status: "rejected" } : m)));

  const commitToTree = (id: string) =>
    setMatches((xs) => xs.map((m) => (m.id === id ? { ...m, status: "committed" } : m)));

  return (
    <div className="min-h-screen bg-[#0b0f12] text-white">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-sm hover:border-yellow-300/60"
          >
            ← Back
          </button>
          <h1 className="text-xl font-semibold">Intention Matches</h1>
        </div>
        <div className="text-sm text-[#96a0aa]">
          {matches.filter((m) => m.status === "new").length} new
        </div>
      </header>

      {/* Content */}
      <main className="grid grid-cols-1 gap-4 p-4 md:grid-cols-[1fr_2fr]">
        {/* Left: Matches list */}
        <section className="rounded-2xl border border-white/10 bg-[#121820]/100 p-3">
          <h2 className="mb-2 text-base text-[#96a0aa]">Matches</h2>
          <ul className="divide-y divide-white/10">
            {matches.map((m) => (
              <li
                key={m.id}
                className={`cursor-pointer px-2 py-3 transition hover:bg-white/5 ${m.id === activeId ? "bg-white/5" : ""}`}
                onClick={() => setActiveId(m.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-semibold ${scoreColor(m.score)}`}
                        title="Match score"
                      >
                        {(m.score * 100).toFixed(0)}%
                      </span>
                      <span className="rounded-md border border-white/15 px-2 py-0.5 text-xs opacity-80">
                        {m.kind}
                      </span>
                      <span className="text-sm opacity-90">@{m.partner.handle}</span>
                    </div>
                    <div className="mt-1 line-clamp-2 text-sm opacity-80">{m.pulse.text}</div>
                  </div>
                  <span
                    className={`ml-3 rounded-md px-2 py-0.5 text-xs ${
                      m.status === "new"
                        ? "border border-yellow-300/60 text-yellow-200"
                        : m.status === "accepted"
                        ? "border border-green-400/60 text-green-300"
                        : m.status === "rejected"
                        ? "border border-red-400/60 text-red-300"
                        : m.status === "committed"
                        ? "border border-blue-400/60 text-blue-300"
                        : "border border-white/15 text-white/80"
                    }`}
                  >
                    {m.status}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Right: Detail */}
        <section className="rounded-2xl border border-white/10 bg-[#121820]/100 p-4">
          {!active ? (
            <div className="text-[#96a0aa]">Select a match to view details.</div>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold">@{active.partner.handle}</h3>
                    <span className="rounded-md border border-white/15 px-2 py-0.5 text-xs opacity-80">
                      {active.kind}
                    </span>
                    <span className={`text-sm ${scoreColor(active.score)}`}>
                      {(active.score * 100).toFixed(0)}% match
                    </span>
                  </div>
                  <div className="text-sm text-[#96a0aa]">
                    Pulse by <b>{active.pulse.by}</b> •{" "}
                    {new Date(active.pulse.createdAtISO).toLocaleString()}
                    {active.partner.location ? ` • ${active.partner.location}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {active.status === "new" && (
                    <button
                      className="rounded-lg border border-white/20 bg-[#1f2633] px-3 py-1.5 text-sm hover:border-yellow-300/60"
                      onClick={() => markReviewed(active.id)}
                    >
                      Mark reviewed
                    </button>
                  )}
                  <button
                    className="rounded-lg border border-green-400/40 bg-[#0d1a12] px-3 py-1.5 text-sm text-green-200 hover:border-green-400/70"
                    onClick={() => accept(active.id)}
                  >
                    Accept
                  </button>
                  <button
                    className="rounded-lg border border-red-400/40 bg-[#1a0d0d] px-3 py-1.5 text-sm text-red-200 hover:border-red-400/70"
                    onClick={() => reject(active.id)}
                  >
                    Reject
                  </button>
                </div>
              </div>

              <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-white/10 p-3">
                  <div className="mb-1 text-sm font-semibold opacity-90">Your pulse</div>
                  <div className="text-sm opacity-90">{active.pulse.text}</div>
                </div>
                <div className="rounded-xl border border-white/10 p-3">
                  <div className="mb-1 text-sm font-semibold opacity-90">Their pulse (preview)</div>
                  <div className="text-sm opacity-90">
                    {active.partnerPulsePreview || "—"}
                  </div>
                </div>
              </div>

              {/* Timeline steps (notify → review → accept → commit) */}
              <div className="mb-4 rounded-xl border border-white/10 p-3">
                <div className="mb-2 text-sm font-semibold opacity-90">Status timeline</div>
                <ol className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <span>1.</span> Match discovered (notification sent)
                  </li>
                  <li className="flex items-center gap-2">
                    <span>2.</span> You review & optionally chat
                  </li>
                  <li className="flex items-center gap-2">
                    <span>3.</span> Accept/Reject
                  </li>
                  <li className="flex items-center gap-2">
                    <span>4.</span> Commit to the Tree (write on-chain / ledger)
                  </li>
                </ol>
              </div>

              {/* Commit action */}
              <div className="flex items-center justify-between">
                <div className="text-sm text-[#96a0aa]">
                  Committing will append this exchange to the Tree (immutable record).
                </div>
                <button
                  className="rounded-lg border border-blue-400/50 bg-[#0c1626] px-3 py-1.5 text-sm text-blue-200 hover:border-blue-400/80 disabled:opacity-50"
                  disabled={active.status !== "accepted"}
                  onClick={() => commitToTree(active.id)}
                >
                  Put on the Tree 🌳
                </button>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}