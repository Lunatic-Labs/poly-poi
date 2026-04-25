import { useEffect, useRef, useState } from "react";
import { playTTS, startRecording, transcribeAudio, type Recorder } from "../../lib/audio";
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
  voiceEnabled?: boolean;
  voiceCharacterId?: string | null;
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

export default function ChatBot({
  slug,
  primaryColor,
  voiceEnabled = false,
  voiceCharacterId = null,
}: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [autoRead, setAutoRead] = useState<boolean>(() => {
    if (!voiceEnabled) return false;
    return localStorage.getItem(`polypoi_voice_autoread_${slug}`) === "true";
  });
  const [playingIdx, setPlayingIdx] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const sessionId = useRef(getSessionId());
  const recorderRef = useRef<Recorder | null>(null);
  const playbackAbortRef = useRef<AbortController | null>(null);

  const voiceReady = voiceEnabled && !!voiceCharacterId;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Persist auto-read preference per slug
  useEffect(() => {
    if (!voiceEnabled) return;
    localStorage.setItem(
      `polypoi_voice_autoread_${slug}`,
      autoRead ? "true" : "false",
    );
  }, [autoRead, slug, voiceEnabled]);

  // Cancel any in-flight playback on unmount
  useEffect(() => {
    return () => playbackAbortRef.current?.abort();
  }, []);

  async function sendMessage() {
    const text = input.trim();
    if (!text || streaming) return;

    const recentHistory = messages
      .slice(-10)
      .map(({ role, content }) => ({ role, content }));

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setStreaming(true);
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: "", streaming: true },
    ]);

    let assistantContent = "";

    try {
      const res = await fetch(`${VISITOR_BASE}/api/${slug}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          session_id: sessionId.current,
          history: recentHistory,
        }),
      });

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      let reading = true;
      while (reading) {
        const { done, value } = await reader.read();
        if (done) { reading = false; break; }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;

          const event = JSON.parse(raw) as
            | { t: string }
            | { done: boolean }
            | { error: string };

          if ("error" in event) {
            assistantContent = event.error;
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
            assistantContent += event.t;
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
      const fallback = !navigator.onLine
        ? "You appear to be offline. Please check your connection and try again."
        : "Something went wrong. Please try again.";
      assistantContent = fallback;
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === "assistant") {
          next[next.length - 1] = { ...last, content: fallback, streaming: false };
        }
        return next;
      });
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
      // Auto-read: play the assembled response if voice mode is on.
      // Index is messages.length AT THIS POINT — user msg + new assistant msg
      // means the new assistant is at length-1 of the current state.
      if (autoRead && voiceReady && assistantContent.trim()) {
        // Compute index based on current length: the last entry is the assistant msg.
        const targetIdx = messages.length + 1; // user push + assistant push
        playMessage(targetIdx, assistantContent).catch(() => {});
      }
    }
  }

  async function playMessage(idx: number, text: string) {
    if (!voiceReady || !voiceCharacterId) return;
    // Cancel any prior playback before starting a new one.
    playbackAbortRef.current?.abort();
    const controller = new AbortController();
    playbackAbortRef.current = controller;
    setPlayingIdx(idx);
    try {
      await playTTS(slug, voiceCharacterId, text, controller.signal);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setVoiceError(err instanceof Error ? err.message : "Audio failed");
    } finally {
      if (playbackAbortRef.current === controller) {
        setPlayingIdx(null);
        playbackAbortRef.current = null;
      }
    }
  }

  function stopPlayback() {
    playbackAbortRef.current?.abort();
  }

  async function toggleRecording() {
    if (transcribing) return;
    if (recording) {
      const recorder = recorderRef.current;
      recorderRef.current = null;
      setRecording(false);
      if (!recorder) return;
      setTranscribing(true);
      try {
        const { blob, mimeType } = await recorder.stop();
        const text = await transcribeAudio(slug, blob, mimeType);
        setInput((prev) => (prev ? `${prev} ${text}` : text));
      } catch (err) {
        setVoiceError(err instanceof Error ? err.message : "Transcription failed");
      } finally {
        setTranscribing(false);
      }
    } else {
      setVoiceError(null);
      try {
        const recorder = await startRecording();
        recorderRef.current = recorder;
        setRecording(true);
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Microphone access denied";
        setVoiceError(msg);
      }
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
      {/* Voice controls strip */}
      {voiceEnabled && (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-white border border-gray-200 px-3 py-2">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={autoRead}
              onChange={(e) => setAutoRead(e.target.checked)}
              disabled={!voiceReady}
              className="h-4 w-4 rounded border-gray-300 disabled:opacity-50"
              style={{ accentColor: primaryColor }}
            />
            Auto-read replies aloud
          </label>
          {!voiceReady && (
            <span className="text-[11px] text-gray-400">Pick a voice to enable</span>
          )}
        </div>
      )}

      {voiceError && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700 flex items-center justify-between">
          <span>{voiceError}</span>
          <button
            onClick={() => setVoiceError(null)}
            className="text-red-500 hover:text-red-700"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {/* Message list */}
      <div className="flex flex-col gap-3 min-h-[300px]">
        {messages.length === 0 && (
          <p className="text-center text-sm text-gray-400 mt-8">
            Ask me anything about this location!
          </p>
        )}
        {messages.map((msg, i) => {
          const isPlaying = playingIdx === i;
          const showSpeaker =
            voiceReady && msg.role === "assistant" && !msg.streaming && msg.content.trim();
          return (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div className="flex flex-col items-start gap-1 max-w-[85%]">
                <div
                  className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
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
                {showSpeaker && (
                  <button
                    onClick={() =>
                      isPlaying ? stopPlayback() : playMessage(i, msg.content)
                    }
                    className="ml-1 flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-600"
                    aria-label={isPlaying ? "Stop playback" : "Read aloud"}
                  >
                    {isPlaying ? (
                      <>
                        <IconStop className="h-3 w-3" />
                        Stop
                      </>
                    ) : (
                      <>
                        <IconSpeaker className="h-3 w-3" />
                        Read aloud
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2 items-end">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            recording ? "Listening… tap mic to stop" : "Ask a question..."
          }
          rows={1}
          maxLength={1000}
          disabled={streaming || recording || transcribing}
          className="flex-1 resize-none rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 disabled:opacity-50"
        />
        {voiceEnabled && (
          <button
            onClick={toggleRecording}
            disabled={streaming || transcribing}
            aria-label={recording ? "Stop recording" : "Start recording"}
            className={`rounded-xl px-3 py-2.5 transition-colors disabled:opacity-40 ${
              recording
                ? "bg-red-500 text-white"
                : "bg-white border border-gray-300 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {transcribing ? (
              <span className="text-xs">…</span>
            ) : (
              <IconMic className="h-5 w-5" />
            )}
          </button>
        )}
        <button
          onClick={sendMessage}
          disabled={!input.trim() || streaming || recording || transcribing}
          className="rounded-xl px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40 transition-opacity"
          style={{ backgroundColor: primaryColor }}
        >
          Send
        </button>
      </div>
    </div>
  );
}

function IconSpeaker({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
      />
    </svg>
  );
}

function IconStop({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

function IconMic({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 11a7 7 0 01-14 0m7 7v4m-4 0h8m-8-15a4 4 0 118 0v6a4 4 0 11-8 0V7z"
      />
    </svg>
  );
}
