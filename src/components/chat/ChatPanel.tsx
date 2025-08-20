import { useState } from "react";

type Msg = { from: "me" | "ai"; text: string };

export default function ChatPanel() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");

  const send = () => {
    const t = text.trim(); if (!t) return;
    setMsgs(m => [...m, { from: "me", text: t }]);
    setText("");
    setTimeout(() => setMsgs(m => [...m, { from: "ai", text: "You said: " + t }]), 400);
  };

  return (
    <div className="card">
      <h2 className="text-base text-muted mb-2">Chat with AI</h2>
      <div className="chat-log mb-2">
        {msgs.map((m, i) => (
          <div key={i} className={`chat-msg ${m.from === "me" ? "chat-me" : "chat-ai"}`}>{m.text}</div>
        ))}
      </div>
      <div className="flex gap-2">
        <textarea className="flex-1 bg-[#0f151b] border border-white/10 rounded-lg p-2"
                  rows={3} placeholder="Type your message..."
                  value={text} onChange={e=>setText(e.target.value)} />
        <button className="btn btn-primary h-fit" onClick={send}>Send</button>
      </div>
    </div>
  );
}
