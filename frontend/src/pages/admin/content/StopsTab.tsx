import { useEffect, useState } from "react";
import { api } from "../../../lib/api";

interface Stop {
  id: string;
  name: string;
  description: string | null;
  lat: number;
  lng: number;
  category: string;
  interest_tags: string[];
}

const CATEGORIES = ["exhibit", "trailhead", "building", "landmark", "other"];

interface StopFormData {
  name: string;
  description: string;
  lat: string;
  lng: string;
  category: string;
  interest_tags: string;
}

const EMPTY_FORM: StopFormData = {
  name: "",
  description: "",
  lat: "",
  lng: "",
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
      lat: String(stop.lat),
      lng: String(stop.lng),
      category: stop.category,
      interest_tags: stop.interest_tags.join(", "),
    });
    setError(null);
    setShowForm(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const lat = parseFloat(form.lat);
    const lng = parseFloat(form.lng);
    if (isNaN(lat) || isNaN(lng)) {
      setError("Latitude and longitude must be valid numbers");
      return;
    }
    const payload = {
      name: form.name,
      description: form.description || null,
      lat,
      lng,
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

  async function handleDelete(stop: Stop) {
    if (!confirm(`Delete "${stop.name}"?`)) return;
    await api.delete(`/api/admin/stops/${stop.id}`);
    setStops((prev) => prev.filter((s) => s.id !== stop.id));
  }

  if (loading) return <div className="py-8 text-center text-sm text-gray-400">Loading…</div>;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-gray-500">{stops.length} stop{stops.length !== 1 ? "s" : ""}</p>
        <button
          onClick={openCreate}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Add stop
        </button>
      </div>

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
                  {stop.category} · {stop.lat.toFixed(4)}, {stop.lng.toFixed(4)}
                  {stop.interest_tags.length > 0 && ` · ${stop.interest_tags.join(", ")}`}
                </p>
              </div>
              <div className="flex gap-2">
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
              <div className="grid grid-cols-2 gap-2">
                <input
                  required
                  placeholder="Latitude *"
                  value={form.lat}
                  onChange={(e) => setForm({ ...form, lat: e.target.value })}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  required
                  placeholder="Longitude *"
                  value={form.lng}
                  onChange={(e) => setForm({ ...form, lng: e.target.value })}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
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
