import { useEffect, useRef, useState } from "react";
import { VISITOR_BASE } from "../../lib/visitorApi";

interface Message {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

interface Props {
  slug: string;
  tenantName: string;
  primaryColor: string;
}

// Stable session ID for the lifetime of this browser tab
function getSessionId(): string {
  const key = `polypoi_session_${window.location.pathname}`;
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(key, id);
  }
  return id;
}

export default function ChatBot({ slug, primaryColor }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const sessionId = useRef(getSessionId());

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || streaming) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setStreaming(true);

    // Add empty assistant message that we'll stream into
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: "", streaming: true },
    ]);

    try {
      const res = await fetch(`${VISITOR_BASE}/api/${slug}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, session_id: sessionId.current }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      let reading = true;
      while (reading) {
        const { done, value } = await reader.read();
        if (done) { reading = false; break; }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? ""; // keep incomplete last line in buffer

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;

          const event = JSON.parse(raw) as
            | { t: string }
            | { done: boolean }
            | { error: string };

          if ("error" in event) {
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last?.role === "assistant") {
                next[next.length - 1] = {
                  ...last,
                  content: event.error,
                  streaming: false,
                };
              }
              return next;
            });
            break;
          }

          if ("done" in event) break;

          if ("t" in event) {
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last?.role === "assistant") {
                next[next.length - 1] = {
                  ...last,
                  content: last.content + event.t,
                };
              }
              return next;
            });
          }
        }
      }
    } catch {
      if (!navigator.onLine) {
        // Offline fallback
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === "assistant") {
            next[next.length - 1] = {
              ...last,
              content:
                "You appear to be offline. Please check your connection and try again.",
              streaming: false,
            };
          }
          return next;
        });
      } else {
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === "assistant") {
            next[next.length - 1] = {
              ...last,
              content: "Something went wrong. Please try again.",
              streaming: false,
            };
          }
          return next;
        });
      }
    } finally {
      setStreaming(false);
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === "assistant" && last.streaming) {
          next[next.length - 1] = { ...last, streaming: false };
        }
        return next;
      });
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Message list */}
      <div className="flex flex-col gap-3 min-h-[300px]">
        {messages.length === 0 && (
          <p className="text-center text-sm text-gray-400 mt-8">
            Ask me anything about this location!
          </p>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === "user"
                  ? "text-white"
                  : "bg-white border border-gray-200 text-gray-800 shadow-sm"
              }`}
              style={
                msg.role === "user" ? { backgroundColor: primaryColor } : undefined
              }
            >
              {msg.content}
              {msg.streaming && (
                <span className="inline-block w-1 h-4 ml-0.5 bg-current animate-pulse rounded-sm" />
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2 items-end">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question..."
          rows={1}
          disabled={streaming}
          className="flex-1 resize-none rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 disabled:opacity-50"
          style={{ focusRingColor: primaryColor } as React.CSSProperties}
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || streaming}
          className="rounded-xl px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40 transition-opacity"
          style={{ backgroundColor: primaryColor }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
