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
  interest_tags: string;
}

const EMPTY_FORM: StopFormData = {
  name: "",
  description: "",
  lat: null,
  lng: null,
  category: "landmark",
  interest_tags: "",
};


export default function StopsTab() {
  const [stops, setStops] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Stop | null>(null);
  const [form, setForm] = useState<StopFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoUploadingFor, setPhotoUploadingFor] = useState<string | null>(null);
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
    setError(null);
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
      interest_tags: stop.interest_tags.join(", "),
    });
    setError(null);
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
      interest_tags: form.interest_tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
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
          <h1 className="text-2xl font-bold text-gray-900">Tour Stops</h1>
          <p className="mt-1 text-sm text-gray-500">
            {stops.length} stop{stops.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={openCreate}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
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
                <p className="text-sm font-medium text-gray-900">{stop.name}</p>
                <p className="text-xs text-gray-400">
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
                  className="text-xs text-gray-500 hover:underline"
                >
                  {stop.photo_urls.length > 0
                    ? `${stop.photo_urls.length} photo${stop.photo_urls.length > 1 ? "s" : ""}`
                    : "Add photo"}
                </button>
                <button
                  onClick={() => openEdit(stop)}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(stop)}
                  className="text-xs text-red-500 hover:underline"
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
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-base font-bold text-gray-900">
              {editing ? "Edit stop" : "Add stop"}
            </h3>
            <form onSubmit={handleSave} className="space-y-3">
              <input
                required
                placeholder="Name *"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <textarea
                placeholder="Description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {editing && (
                <div>
                  {editing.photo_urls.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-2">
                      {editing.photo_urls.map((url, i) => (
                        <div key={i} className="relative">
                          <img src={url} alt="" className="h-20 w-20 rounded-lg object-cover" />
                          <button
                            type="button"
                            onClick={() => handlePhotoDelete(url)}
                            className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-gray-900/60 text-white hover:bg-red-600"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setPhotoUploadingFor(editing.id);
                      fileInputRef.current?.click();
                    }}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
                  >
                    + Add photo
                  </button>
                </div>
              )}
              <LocationPicker
                lat={form.lat}
                lng={form.lng}
                onChange={(lat, lng) => setForm({ ...form, lat, lng })}
              />
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <input
                placeholder="Interest tags (comma-separated)"
                value={form.interest_tags}
                onChange={(e) => setForm({ ...form, interest_tags: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
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
                  className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
