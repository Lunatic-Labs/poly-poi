import { useState } from "react";
import { playTTS } from "../lib/audio";
import type { VisitorVoiceCharacter } from "../lib/visitorApi";

interface Props {
  slug: string;
  primaryColor: string;
  voices: VisitorVoiceCharacter[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const SAMPLE_TEXT = "Hi there, I'll be your guide today.";

export default function VoicePicker({
  slug,
  primaryColor,
  voices,
  selectedId,
  onSelect,
}: Props) {
  const [open, setOpen] = useState(false);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const selected = voices.find((v) => v.id === selectedId) ?? null;

  async function handlePreview(id: string) {
    if (previewingId) return;
    setPreviewingId(id);
    try {
      await playTTS(slug, id, SAMPLE_TEXT);
    } catch {
      /* ignore preview failures — visitor can still pick */
    } finally {
      setPreviewingId(null);
    }
  }

  if (voices.length === 0) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600 hover:bg-gray-50"
      >
        <IconChevronDown className="h-3 w-3 text-gray-400" />
        <span>
          Voice: <span className="font-medium text-gray-900">{selected?.name ?? "Pick a voice"}</span>
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-t-2xl bg-white p-4 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900">Choose a voice</h3>
              <button
                onClick={() => setOpen(false)}
                className="text-2xl text-gray-400 hover:text-gray-600"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {voices.map((voice) => {
                const isSelected = voice.id === selectedId;
                const isPreviewing = previewingId === voice.id;
                return (
                  <div
                    key={voice.id}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-3 ${
                      isSelected ? "bg-gray-50" : "bg-white"
                    }`}
                    style={isSelected ? { borderColor: primaryColor } : { borderColor: "#e5e7eb" }}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900">{voice.name}</p>
                      {voice.description && (
                        <p className="truncate text-xs text-gray-500">{voice.description}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handlePreview(voice.id)}
                      disabled={!!previewingId}
                      className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                      aria-label="Preview voice"
                    >
                      {isPreviewing ? "…" : "▶"}
                    </button>
                    {isSelected ? (
                      <span
                        className="rounded-md px-3 py-1 text-xs font-medium text-white"
                        style={{ backgroundColor: primaryColor }}
                      >
                        Picked
                      </span>
                    ) : (
                      <button
                        onClick={() => {
                          onSelect(voice.id);
                          setOpen(false);
                        }}
                        className="rounded-md border px-3 py-1 text-xs font-medium hover:bg-gray-50"
                        style={{ borderColor: primaryColor, color: primaryColor }}
                      >
                        Pick
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function IconChevronDown({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}
