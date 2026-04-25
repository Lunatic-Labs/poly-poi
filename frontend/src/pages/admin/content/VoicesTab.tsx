import { useEffect, useRef, useState } from "react";
import { api } from "../../../lib/api";

interface VoiceCharacter {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  hume_voice_id: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

interface VoiceFormData {
  name: string;
  description: string;
  is_default: boolean;
}

interface DesignPreviewResponse {
  generation_id: string;
  audio_base64: string;
  format: string;
}

const EMPTY_FORM: VoiceFormData = { name: "", description: "", is_default: false };

export default function VoicesTab() {
  const [voices, setVoices] = useState<VoiceCharacter[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<VoiceCharacter | null>(null);
  const [form, setForm] = useState<VoiceFormData>(EMPTY_FORM);
  const [previewing, setPreviewing] = useState(false);
  const [previewedGenId, setPreviewedGenId] = useState<string | null>(null);
  const [previewAudioSrc, setPreviewAudioSrc] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    api
      .get<VoiceCharacter[]>("/api/admin/voice-characters")
      .then(setVoices)
      .finally(() => setLoading(false));
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setPreviewedGenId(null);
    setPreviewAudioSrc(null);
    setError(null);
    setShowForm(true);
  }

  function openEdit(voice: VoiceCharacter) {
    setEditing(voice);
    setForm({
      name: voice.name,
      description: voice.description ?? "",
      is_default: voice.is_default,
    });
    // Editing existing rows skips the preview/regenerate path — only metadata changes.
    setPreviewedGenId(null);
    setPreviewAudioSrc(null);
    setError(null);
    setShowForm(true);
  }

  async function handlePreview() {
    if (!form.description || form.description.length < 4) {
      setError("Description must be at least 4 characters");
      return;
    }
    setError(null);
    setPreviewing(true);
    try {
      const res = await api.post<DesignPreviewResponse>(
        "/api/admin/voice-characters/design-preview",
        { description: form.description },
      );
      setPreviewedGenId(res.generation_id);
      setPreviewAudioSrc(`data:audio/${res.format};base64,${res.audio_base64}`);
      // Auto-play once it loads
      setTimeout(() => audioRef.current?.play().catch(() => {}), 50);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Voice preview failed");
    } finally {
      setPreviewing(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) {
      setError("Name is required");
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        const updated = await api.patch<VoiceCharacter>(
          `/api/admin/voice-characters/${editing.id}`,
          {
            name: form.name,
            description: form.description || null,
            is_default: form.is_default,
          },
        );
        setVoices((prev) => {
          const next = prev.map((v) =>
            v.id === updated.id ? updated : updated.is_default ? { ...v, is_default: false } : v,
          );
          return next;
        });
      } else {
        if (!previewedGenId) {
          setError("Preview the voice before saving");
          setSaving(false);
          return;
        }
        const created = await api.post<VoiceCharacter>("/api/admin/voice-characters", {
          name: form.name,
          description: form.description || null,
          generation_id: previewedGenId,
          is_default: form.is_default,
        });
        setVoices((prev) => [
          created,
          ...(created.is_default ? prev.map((v) => ({ ...v, is_default: false })) : prev),
        ]);
      }
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save voice");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(voice: VoiceCharacter) {
    if (!confirm(`Delete "${voice.name}"?`)) return;
    await api.delete(`/api/admin/voice-characters/${voice.id}`);
    setVoices((prev) => prev.filter((v) => v.id !== voice.id));
  }

  if (loading) return <div className="py-8 text-center text-sm text-gray-400">Loading…</div>;

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy">Voices</h1>
          <p className="mt-1 text-sm text-brand-jade">
            Voice characters visitors can pick from when reading replies aloud
          </p>
        </div>
        <button
          onClick={openCreate}
          className="rounded-lg bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-navy/90"
        >
          + Add voice
        </button>
      </div>

      {/* List */}
      {voices.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 py-10 text-center text-sm text-gray-400">
          Design your first voice character to get started.
        </div>
      ) : (
        <div className="space-y-2">
          {voices.map((voice) => (
            <div
              key={voice.id}
              className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-brand-navy">{voice.name}</p>
                  {voice.is_default && (
                    <span className="rounded-full bg-brand-jade/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-jade">
                      Default
                    </span>
                  )}
                </div>
                {voice.description && (
                  <p className="truncate text-xs text-brand-jade">{voice.description}</p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => openEdit(voice)}
                  className="text-xs text-brand-navy hover:underline"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(voice)}
                  className="text-xs text-brand-blush hover:underline"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="overflow-y-auto p-6">
              <h3 className="mb-4 text-base font-bold text-brand-navy">
                {editing ? "Edit voice" : "Design voice"}
              </h3>
              <form onSubmit={handleSave} className="space-y-3">
                <input
                  required
                  placeholder="Name *"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  maxLength={80}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy"
                />
                <div>
                  <textarea
                    placeholder="Describe the voice — e.g. 'a warm museum docent, slightly southern, unhurried'"
                    value={form.description}
                    onChange={(e) => {
                      setForm({ ...form, description: e.target.value });
                      // Description change invalidates the previous preview
                      if (previewedGenId) {
                        setPreviewedGenId(null);
                        setPreviewAudioSrc(null);
                      }
                    }}
                    rows={3}
                    maxLength={500}
                    disabled={!!editing}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy disabled:bg-gray-50 disabled:text-gray-500"
                  />
                  {editing && (
                    <p className="mt-1 text-xs text-gray-400">
                      Description is fixed once a voice has been generated.
                    </p>
                  )}
                </div>

                {/* Preview / regenerate (only when creating) */}
                {!editing && (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-gray-700">
                        {previewedGenId ? "Preview ready" : "Preview before saving"}
                      </p>
                      <button
                        type="button"
                        onClick={handlePreview}
                        disabled={previewing || form.description.length < 4}
                        className="rounded-md border border-brand-navy px-3 py-1 text-xs font-medium text-brand-navy hover:bg-brand-sky/20 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {previewing
                          ? "Generating…"
                          : previewedGenId
                            ? "Regenerate"
                            : "Preview"}
                      </button>
                    </div>
                    {previewAudioSrc && (
                      <audio
                        ref={audioRef}
                        controls
                        src={previewAudioSrc}
                        className="mt-2 w-full"
                      />
                    )}
                  </div>
                )}

                {/* Default toggle */}
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.is_default}
                    onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-brand-navy focus:ring-brand-navy"
                  />
                  Use as default voice
                </label>

                {error && <p className="text-xs text-red-600">{error}</p>}

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving || (!editing && !previewedGenId)}
                    className="rounded-lg bg-brand-navy px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-navy/90 disabled:opacity-50"
                  >
                    {saving ? "Saving…" : "Save"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
