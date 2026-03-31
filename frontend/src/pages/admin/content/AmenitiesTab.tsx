import { useEffect, useState } from "react";
import { api } from "../../../lib/api";

interface Amenity {
  id: string;
  name: string;
  type: string;
  lat: number;
  lng: number;
  notes: string | null;
}

const AMENITY_TYPES = [
  "restroom",
  "food",
  "parking",
  "emergency",
  "gift",
  "partner",
  "other",
];

interface AmenityFormData {
  name: string;
  type: string;
  lat: string;
  lng: string;
  notes: string;
}

const EMPTY_FORM: AmenityFormData = {
  name: "",
  type: "restroom",
  lat: "",
  lng: "",
  notes: "",
};

export default function AmenitiesTab() {
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Amenity | null>(null);
  const [form, setForm] = useState<AmenityFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Amenity[]>("/api/admin/amenities")
      .then(setAmenities)
      .finally(() => setLoading(false));
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError(null);
    setShowForm(true);
  }

  function openEdit(amenity: Amenity) {
    setEditing(amenity);
    setForm({
      name: amenity.name,
      type: amenity.type,
      lat: String(amenity.lat),
      lng: String(amenity.lng),
      notes: amenity.notes ?? "",
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
      type: form.type,
      lat,
      lng,
      notes: form.notes || null,
    };
    setSaving(true);
    try {
      if (editing) {
        const updated = await api.patch<Amenity>(
          `/api/admin/amenities/${editing.id}`,
          payload,
        );
        setAmenities((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      } else {
        const created = await api.post<Amenity>("/api/admin/amenities", payload);
        setAmenities((prev) => [...prev, created]);
      }
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save amenity");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(amenity: Amenity) {
    if (!confirm(`Delete "${amenity.name}"?`)) return;
    await api.delete(`/api/admin/amenities/${amenity.id}`);
    setAmenities((prev) => prev.filter((a) => a.id !== amenity.id));
  }

  if (loading) return <div className="py-8 text-center text-sm text-gray-400">Loading…</div>;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {amenities.length} amenit{amenities.length !== 1 ? "ies" : "y"}
        </p>
        <button
          onClick={openCreate}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Add amenity
        </button>
      </div>

      {amenities.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 py-10 text-center text-sm text-gray-400">
          No amenities yet. Add restrooms, parking, food vendors, and more.
        </div>
      ) : (
        <div className="space-y-2">
          {amenities.map((amenity) => (
            <div
              key={amenity.id}
              className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">{amenity.name}</p>
                <p className="text-xs text-gray-400">
                  {amenity.type} · {amenity.lat.toFixed(4)}, {amenity.lng.toFixed(4)}
                  {amenity.notes && ` · ${amenity.notes}`}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => openEdit(amenity)}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(amenity)}
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
              {editing ? "Edit amenity" : "Add amenity"}
            </h3>
            <form onSubmit={handleSave} className="space-y-3">
              <input
                required
                placeholder="Name *"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {AMENITY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
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
              <input
                placeholder="Notes (optional)"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
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
