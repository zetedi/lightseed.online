import { useState, useEffect, useRef } from "react";

interface ChatMessage {
  id: string;
  text: string;
  sender: "user" | "ai";
}

interface ChatPanelProps {
  apiKey: string;
}

export default function ChatPanel({ apiKey }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || !apiKey) return;

    const userMessage: ChatMessage = { id: crypto.randomUUID(), text: input, sender: "user" };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("https://api.x.ai/v1/grok", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "grok",
          messages: [{ role: "user", content: input }],
          max_tokens: 150,
        }),
      });

      if (!response.ok) throw new Error("API request failed");
      const data = await response.json();
      const aiMessage: ChatMessage = {
        id: crypto.randomUUID(),
        text: data.choices[0].message.content,
        sender: "ai",
      };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      const errorMessage = error instanceof Error ? `Error: ${error.message}` : "An unknown error occurred";
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), text: errorMessage, sender: "ai" },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="card bg-card border border-border p-3 rounded-2xl h-[300px] flex flex-col">
      <h2 className="text-base text-muted-foreground">Chat with AI</h2>
      <div className="flex-1 overflow-y-auto mb-2">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`my-2 p-2 rounded-lg ${
              msg.sender === "user" ? "bg-accent text-accent-foreground ml-auto" : "bg-muted text-muted-foreground"
            }`}
          >
            {msg.text}
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>
      <div className="flex gap-2">
        <input
          className="flex-1 bg-card border border-border rounded-lg p-2 text-foreground"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Type a message..."
          disabled={isLoading}
        />
        <button
          className="btn btn-primary text-primary-foreground"
          onClick={sendMessage}
          disabled={isLoading}
        >
          Send
        </button>
      </div>
    </div>
  );
}