import { useEffect, useRef, useState } from "react";
import { api } from "../../../lib/api";
import LocationPicker from "../../../components/LocationPicker";
import PoiMap from "../../../components/PoiMap";

interface Stop {
  id: string;
  name: string;
  description: string | null;
  lat: number;
  lng: number;
  category: string;
  is_accessible: boolean;
  interest_tags: string[];
  photo_urls: string[];
}

const CATEGORIES = ["exhibit", "trailhead", "building", "landmark", "other"];

interface StopFormData {
  name: string;
  description: string;
  lat: number | null;
  lng: number | null;
  category: string;
  is_accessible: boolean;
  interest_tags: string[];
}

const EMPTY_FORM: StopFormData = {
  name: "",
  description: "",
  lat: null,
  lng: null,
  category: "landmark",
  is_accessible: false,
  interest_tags: [],
};


export default function StopsTab() {
  const [stops, setStops] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Stop | null>(null);
  const [form, setForm] = useState<StopFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [photoUploadingFor, setPhotoUploadingFor] = useState<string | null>(null);
  const [photoIndex, setPhotoIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !photoUploadingFor) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      const updated = await api.postForm<Stop>(
        `/api/admin/stops/${photoUploadingFor}/photo`,
        formData,
      );
      setStops((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      if (editing?.id === updated.id) setEditing(updated);
    } catch {
      // silently fail — no global error UI for photo upload
    } finally {
      setPhotoUploadingFor(null);
      e.target.value = "";
    }
  }

  useEffect(() => {
    api
      .get<Stop[]>("/api/admin/stops")
      .then(setStops)
      .finally(() => setLoading(false));
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setTagInput("");
    setError(null);
    setPhotoIndex(0);
    setShowForm(true);
  }

  function openEdit(stop: Stop) {
    setEditing(stop);
    setForm({
      name: stop.name,
      description: stop.description ?? "",
      lat: stop.lat,
      lng: stop.lng,
      category: stop.category,
      is_accessible: stop.is_accessible,
      interest_tags: [...stop.interest_tags],
    });
    setTagInput("");
    setError(null);
    setPhotoIndex(0);
    setShowForm(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (form.lat === null || form.lng === null) {
      setError("Please search for and select a location");
      return;
    }
    const payload = {
      name: form.name,
      description: form.description || null,
      lat: form.lat,
      lng: form.lng,
      category: form.category,
      is_accessible: form.is_accessible,
      interest_tags: form.interest_tags,
    };
    setSaving(true);
    try {
      if (editing) {
        const updated = await api.patch<Stop>(`/api/admin/stops/${editing.id}`, payload);
        setStops((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      } else {
        const created = await api.post<Stop>("/api/admin/stops", payload);
        setStops((prev) => [...prev, created]);
      }
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save stop");
    } finally {
      setSaving(false);
    }
  }

  async function handlePhotoDelete(url: string) {
    if (!editing) return;
    await api.delete(`/api/admin/stops/${editing.id}/photo?url=${encodeURIComponent(url)}`);
    const updated = { ...editing, photo_urls: editing.photo_urls.filter((u) => u !== url) };
    setEditing(updated);
    setStops((prev) => prev.map((s) => (s.id === editing.id ? updated : s)));
    setPhotoIndex((i) => Math.max(0, Math.min(i, updated.photo_urls.length - 1)));
  }

  async function handleDelete(stop: Stop) {
    if (!confirm(`Delete "${stop.name}"?`)) return;
    await api.delete(`/api/admin/stops/${stop.id}`);
    setStops((prev) => prev.filter((s) => s.id !== stop.id));
  }

  if (loading) return <div className="py-8 text-center text-sm text-gray-400">Loading…</div>;

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handlePhotoChange}
      />

      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy">Tour Stops</h1>
          <p className="mt-1 text-sm text-brand-jade">
            {stops.length} stop{stops.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={openCreate}
          className="rounded-lg bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-navy/90"
        >
          + Add stop
        </button>
      </div>

      {/* Two-column layout: list + map */}
      <div className={stops.length > 0 ? "grid grid-cols-5 gap-6" : ""}>
        <div className={stops.length > 0 ? "col-span-3" : ""}>
          {stops.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 py-10 text-center text-sm text-gray-400">
              No stops yet. Add your first tour stop.
            </div>
          ) : (
            <div className="space-y-2">
              {stops.map((stop) => (
            <div
              key={stop.id}
              className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-brand-navy">
                  {stop.name}
                  {stop.is_accessible && (
                    <span className="ml-1.5 text-brand-navy" title="Accessible">&#x267F;</span>
                  )}
                </p>
                <p className="text-xs text-brand-jade">
                  {stop.category}
                  {stop.interest_tags.length > 0 && ` · ${stop.interest_tags.join(", ")}`}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setPhotoUploadingFor(stop.id);
                    fileInputRef.current?.click();
                  }}
                  className="text-xs text-brand-jade hover:underline"
                >
                  {stop.photo_urls.length > 0
                    ? `${stop.photo_urls.length} photo${stop.photo_urls.length > 1 ? "s" : ""}`
                    : "Add photo"}
                </button>
                <button
                  onClick={() => openEdit(stop)}
                  className="text-xs text-brand-navy hover:underline"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(stop)}
                  className="text-xs text-brand-blush hover:underline"
                >
                  Delete
                </button>
              </div>
            </div>
              ))}
            </div>
          )}
        </div>

        {/* Map panel */}
        {stops.length > 0 && (
          <div className="col-span-2">
            <PoiMap items={stops} />
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-xl">

            {/* Photo hero — edit mode only */}
            {editing && (() => {
              const photos = editing.photo_urls;
              const idx = Math.min(photoIndex, Math.max(0, photos.length - 1));
              return (
                <div className="relative h-56 shrink-0 bg-gray-100">
                  {photos.length > 0 ? (
                    <img src={photos[idx]} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-2 text-gray-300">
                      <svg className="h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="text-sm">No photos yet</p>
                    </div>
                  )}

                  {/* Prev / Next */}
                  {photos.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={() => setPhotoIndex((i) => (i - 1 + photos.length) % photos.length)}
                        className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-gray-900/50 text-lg text-white hover:bg-gray-900/70"
                      >
                        ‹
                      </button>
                      <button
                        type="button"
                        onClick={() => setPhotoIndex((i) => (i + 1) % photos.length)}
                        className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-gray-900/50 text-lg text-white hover:bg-gray-900/70"
                      >
                        ›
                      </button>
                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-gray-900/50 px-2 py-0.5 text-xs text-white">
                        {idx + 1} / {photos.length}
                      </div>
                    </>
                  )}

                  {/* Delete + Add photo row */}
                  <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
                    {photos.length > 0 && (
                      <button
                        type="button"
                        onClick={() => handlePhotoDelete(photos[idx])}
                        className="flex items-center justify-center rounded-lg bg-white/80 p-1.5 text-gray-400 shadow-sm hover:bg-white hover:text-brand-blush"
                        title="Delete photo"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => { setPhotoUploadingFor(editing.id); fileInputRef.current?.click(); }}
                      className="rounded-lg bg-white/90 px-2.5 py-1 text-xs font-medium text-gray-700 shadow-sm hover:bg-white"
                    >
                      + Add photo
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Scrollable form content */}
            <div className="overflow-y-auto p-6">
              <h3 className="mb-4 text-base font-bold text-brand-navy">
                {editing ? "Edit stop" : "Add stop"}
              </h3>
              <form onSubmit={handleSave} className="space-y-3">
                <input
                  required
                  placeholder="Name *"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy"
                />
                <textarea
                  placeholder="Description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy"
                />
                <LocationPicker
                  lat={form.lat}
                  lng={form.lng}
                  onChange={(lat, lng) => setForm({ ...form, lat, lng })}
                />
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-2 py-1">
                  <input
                    type="checkbox"
                    checked={form.is_accessible}
                    onChange={(e) => setForm({ ...form, is_accessible: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-brand-navy focus:ring-2 focus:ring-brand-navy"
                  />
                  <span className="text-sm text-gray-700">Handicap accessible</span>
                </label>
                {/* Tag pill input */}
                <div className="flex min-h-[38px] flex-wrap gap-1.5 rounded-lg border border-gray-300 px-2.5 py-2 focus-within:ring-2 focus-within:ring-brand-navy">
                  {form.interest_tags.map((tag) => (
                    <span
                      key={tag}
                      className="group flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-700"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() =>
                          setForm({
                            ...form,
                            interest_tags: form.interest_tags.filter((t) => t !== tag),
                          })
                        }
                        className="leading-none text-gray-400 opacity-0 transition-opacity hover:text-gray-700 group-hover:opacity-100"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const val = tagInput.trim();
                        if (val && !form.interest_tags.includes(val)) {
                          setForm({ ...form, interest_tags: [...form.interest_tags, val] });
                        }
                        setTagInput("");
                      }
                    }}
                    placeholder={form.interest_tags.length === 0 ? "Add tags — press Enter" : ""}
                    className="min-w-[140px] flex-1 bg-transparent text-sm outline-none"
                  />
                </div>
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
                    disabled={saving}
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
