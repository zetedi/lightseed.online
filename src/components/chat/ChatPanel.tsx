import { useState } from "react";
import axios from "axios";

type Msg = { from: "me" | "ai"; text: string };

export default function ChatPanel() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const send = async () => {
    const t = text.trim();
    if (!t) return;
    setMsgs((m) => [...m, { from: "me", text: t }]);
    setText("");
    setIsLoading(true);
    try {
      const apiKey = (import.meta.env as ImportMetaEnv).VITE_XAI_API_KEY;
      if (!apiKey) {
        throw new Error("VITE_XAI_API_KEY is not defined in .env");
      }
      const response = await axios.post(
        "https://api.x.ai/v1/chat",
        { message: t },
        {
          headers: { Authorization: `Bearer ${apiKey}` },
        }
      );
      setMsgs((m) => [...m, { from: "ai", text: response.data.reply }]);
    } catch (error) {
      setMsgs((m) => [
        ...m,
        { from: "ai", text: `Error: ${error instanceof Error ? error.message : "Unknown error"}` },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="card">
      <h2 className="text-base text-muted mb-2">Chat with AI</h2>
      <div className="chat-log mb-2">
        {msgs.map((m, i) => (
          <div key={i} className={`chat-msg ${m.from === "me" ? "chat-me" : "chat-ai"}`}>
            {m.text}
          </div>
        ))}
        {isLoading && <div className="chat-msg chat-ai">Thinking...</div>}
      </div>
      <div className="flex gap-2">
        <textarea
          className="flex-1 bg-[#0f151b] border border-white/10 rounded-lg p-2"
          rows={3}
          placeholder="Type your message..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={isLoading}
        />
        <button className="btn btn-primary h-fit" onClick={send} disabled={isLoading}>
          Send
        </button>
      </div>
    </div>
  );
}