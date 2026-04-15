import { useState } from "react";
import { api } from "../../../lib/api";
import LocationPicker from "../../../components/LocationPicker";

interface Props {
  onNext: () => void;
  onBack: () => void;
}

interface AmenityDraft {
  type: string;
  name: string;
  lat: number | null;
  lng: number | null;
  checked: boolean;
}

const AMENITY_DEFAULTS: { type: string; label: string; defaultName: string }[] = [
  { type: "restroom", label: "Restrooms", defaultName: "Restrooms" },
  { type: "parking", label: "Parking", defaultName: "Main Parking Lot" },
  { type: "food", label: "Food / Café", defaultName: "Café" },
  { type: "gift", label: "Gift Shop", defaultName: "Gift Shop" },
  { type: "emergency", label: "Emergency / First Aid", defaultName: "First Aid Station" },
];

export default function Step4Amenities({ onNext, onBack }: Props) {
  const [amenities, setAmenities] = useState<AmenityDraft[]>(
    AMENITY_DEFAULTS.map((a) => ({ type: a.type, name: a.defaultName, lat: null, lng: null, checked: false })),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(i: number) {
    setAmenities((prev) => prev.map((a, idx) => (idx === i ? { ...a, checked: !a.checked } : a)));
  }

  function update(i: number, field: "name", value: string) {
    setAmenities((prev) => prev.map((a, idx) => (idx === i ? { ...a, [field]: value } : a)));
  }

  function updateLocation(i: number, lat: number, lng: number) {
    setAmenities((prev) => prev.map((a, idx) => (idx === i ? { ...a, lat, lng } : a)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const selected = amenities.filter((a) => a.checked);
    if (selected.length === 0) {
      onNext();
      return;
    }

    for (const a of selected) {
      if (a.lat === null || a.lng === null) {
        setError(`"${a.name}" needs a location — search for it above`);
        return;
      }
    }

    setSaving(true);
    try {
      await Promise.all(
        selected.map((a) =>
          api.post("/api/admin/amenities", {
            name: a.name,
            type: a.type,
            lat: a.lat,
            lng: a.lng,
          }),
        ),
      );
      onNext();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save amenities");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-gray-500">
        Check the amenities your site has and fill in their locations.
      </p>

      <div className="space-y-2">
        {amenities.map((amenity, i) => (
          <div key={amenity.type} className="rounded-xl border border-gray-200">
            <label className="flex cursor-pointer items-center gap-3 px-4 py-3">
              <input
                type="checkbox"
                checked={amenity.checked}
                onChange={() => toggle(i)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-800">
                {AMENITY_DEFAULTS[i].label}
              </span>
            </label>

            {amenity.checked && (
              <div className="border-t border-gray-100 bg-gray-50 rounded-b-xl px-4 py-3 space-y-2">
                <input
                  placeholder="Name"
                  value={amenity.name}
                  onChange={(e) => update(i, "name", e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <LocationPicker
                  lat={amenity.lat}
                  lng={amenity.lng}
                  onChange={(lat, lng) => updateLocation(i, lat, lng)}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-gray-400 hover:text-gray-600"
        >
          ← Back
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onNext}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-500 hover:bg-gray-50"
          >
            Skip
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Finish setup →"}
          </button>
        </div>
      </div>
    </form>
  );
}
