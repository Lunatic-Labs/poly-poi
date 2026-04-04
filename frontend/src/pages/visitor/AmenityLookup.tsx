import { useEffect, useState } from "react";
import type { VisitorAmenity } from "../../lib/visitorApi";

interface Props {
  amenities: VisitorAmenity[];
}

const TYPE_CONFIG: {
  type: VisitorAmenity["type"];
  label: string;
  emoji: string;
}[] = [
  { type: "restroom", label: "Restrooms", emoji: "🚻" },
  { type: "food", label: "Food & Drink", emoji: "🍽️" },
  { type: "parking", label: "Parking", emoji: "🅿️" },
  { type: "emergency", label: "Emergency", emoji: "🚑" },
  { type: "gift", label: "Gift Shop", emoji: "🛍️" },
  { type: "partner", label: "Partner", emoji: "🤝" },
  { type: "other", label: "Other", emoji: "📍" },
];

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function AmenityLookup({ amenities }: Props) {
  const availableTypes = [...new Set(amenities.map((a) => a.type))];
  const [activeType, setActiveType] = useState<VisitorAmenity["type"] | null>(
    availableTypes[0] ?? null,
  );
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {}, // silently fall back to list order if denied
    );
  }, []);

  const filtered = amenities.filter((a) => a.type === activeType);
  const sorted =
    userPos === null
      ? filtered
      : [...filtered].sort(
          (a, b) =>
            haversineKm(userPos.lat, userPos.lng, a.lat, a.lng) -
            haversineKm(userPos.lat, userPos.lng, b.lat, b.lng),
        );

  const tabs = TYPE_CONFIG.filter((t) => availableTypes.includes(t.type));

  if (amenities.length === 0) {
    return (
      <p className="text-center text-sm text-gray-400 mt-8">
        No services have been added yet.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Type tabs */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map(({ type, label, emoji }) => (
          <button
            key={type}
            onClick={() => setActiveType(type)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              activeType === type
                ? "bg-gray-800 border-gray-800 text-white"
                : "border-gray-300 text-gray-600 bg-white"
            }`}
          >
            <span>{emoji}</span>
            {label}
          </button>
        ))}
      </div>

      {/* Amenity list */}
      {userPos && (
        <p className="text-xs text-gray-400">Sorted by distance from your location</p>
      )}

      <div className="flex flex-col gap-2">
        {sorted.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-4">
            None listed for this category.
          </p>
        ) : (
          sorted.map((amenity) => {
            const distKm =
              userPos !== null
                ? haversineKm(userPos.lat, userPos.lng, amenity.lat, amenity.lng)
                : null;

            return (
              <div
                key={amenity.id}
                className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm flex items-start justify-between gap-3"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-gray-900">
                    {amenity.name}
                  </span>
                  {amenity.notes && (
                    <span className="text-xs text-gray-500">{amenity.notes}</span>
                  )}
                </div>
                {distKm !== null && (
                  <span className="text-xs text-gray-400 flex-shrink-0 mt-0.5">
                    {distKm < 1
                      ? `${Math.round(distKm * 1000)} m`
                      : `${distKm.toFixed(1)} km`}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
