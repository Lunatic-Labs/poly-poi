import { useState } from "react";
import { api } from "../../../lib/api";

interface Props {
  onNext: () => void;
}

interface StopDraft {
  name: string;
  description: string;
  lat: string;
  lng: string;
  category: string;
}

const EMPTY: StopDraft = { name: "", description: "", lat: "", lng: "", category: "landmark" };
const CATEGORIES = ["exhibit", "trailhead", "building", "landmark", "other"];

export default function Step3Stops({ onNext }: Props) {
  const [stops, setStops] = useState<StopDraft[]>([{ ...EMPTY }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateStop(i: number, field: keyof StopDraft, value: string) {
    setStops((prev) => prev.map((s, idx) => (idx === i ? { ...s, [field]: value } : s)));
  }

  function addStop() {
    setStops((prev) => [...prev, { ...EMPTY }]);
  }

  function removeStop(i: number) {
    setStops((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const valid = stops.filter((s) => s.name.trim());
    if (valid.length === 0) {
      onNext();
      return;
    }

    for (const s of valid) {
      const lat = parseFloat(s.lat);
      const lng = parseFloat(s.lng);
      if (isNaN(lat) || isNaN(lng)) {
        setError(`"${s.name}" has invalid coordinates`);
        return;
      }
    }

    setSaving(true);
    try {
      await Promise.all(
        valid.map((s) =>
          api.post("/api/admin/stops", {
            name: s.name,
            description: s.description || null,
            lat: parseFloat(s.lat),
            lng: parseFloat(s.lng),
            category: s.category,
          }),
        ),
      );
      onNext();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save stops");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-gray-500">
        Add your first tour stops. You can add more from the dashboard later.
      </p>

      {stops.map((stop, i) => (
        <div key={i} className="rounded-xl border border-gray-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Stop {i + 1}
            </span>
            {stops.length > 1 && (
              <button
                type="button"
                onClick={() => removeStop(i)}
                className="text-xs text-red-500 hover:underline"
              >
                Remove
              </button>
            )}
          </div>
          <input
            placeholder="Stop name"
            value={stop.name}
            onChange={(e) => updateStop(i, "name", e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <textarea
            placeholder="Description (optional)"
            value={stop.description}
            onChange={(e) => updateStop(i, "description", e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              placeholder="Latitude"
              value={stop.lat}
              onChange={(e) => updateStop(i, "lat", e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              placeholder="Longitude"
              value={stop.lng}
              onChange={(e) => updateStop(i, "lng", e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={stop.category}
            onChange={(e) => updateStop(i, "category", e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      ))}

      <button
        type="button"
        onClick={addStop}
        className="w-full rounded-lg border border-dashed border-gray-300 py-2 text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700"
      >
        + Add another stop
      </button>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onNext}
          className="flex-1 rounded-lg border border-gray-200 py-2 text-sm text-gray-500 hover:bg-gray-50"
        >
          Skip for now
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Next: Amenities →"}
        </button>
      </div>
    </form>
  );
}
