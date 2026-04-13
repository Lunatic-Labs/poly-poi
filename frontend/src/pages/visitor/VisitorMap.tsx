import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useMemo, useState } from 'react';
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from 'react-leaflet';
import { useEffect } from 'react';
import type {
  VisitorAmenity,
  VisitorRoute,
  VisitorStop,
} from '../../lib/visitorApi';

// Fix Leaflet's default icon paths under Vite
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)
  ._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const AMENITY_EMOJI: Record<string, string> = {
  restroom: '🚻',
  food: '🍽️',
  parking: '🅿️',
  emergency: '🚑',
  gift: '🛍️',
  partner: '🤝',
  other: '📍',
};

function amenityIcon(type: string): L.DivIcon {
  return L.divIcon({
    html: `<span style="font-size:20px;line-height:1">${AMENITY_EMOJI[type] ?? '📍'}</span>`,
    className: '',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });
}

type AmenityType = VisitorAmenity['type'];

const AMENITY_TYPES: { type: AmenityType; label: string }[] = [
  { type: 'restroom', label: 'Restrooms' },
  { type: 'food', label: 'Food & Drink' },
  { type: 'parking', label: 'Parking' },
  { type: 'emergency', label: 'Emergency' },
  { type: 'gift', label: 'Gift Shop' },
  { type: 'partner', label: 'Partner' },
  { type: 'other', label: 'Other' },
];

function FitBounds({ items }: { items: { lat: number; lng: number }[] }) {
  const map = useMap();
  useEffect(() => {
    if (items.length === 0) return;
    if (items.length === 1) {
      map.setView([items[0].lat, items[0].lng], 15);
      return;
    }
    map.fitBounds(L.latLngBounds(items.map((i) => [i.lat, i.lng])), {
      padding: [30, 30],
    });
  }, [items, map]);
  return null;
}

// ── Stop detail card (modal) ───────────────────────────────────────────────

function StopCard({
  stop,
  onClose,
}: {
  stop: VisitorStop;
  onClose: () => void;
}) {
  const hasPhoto = stop.photo_urls.length > 0;

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 px-5"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xs overflow-hidden rounded-3xl shadow-2xl"
        style={{ aspectRatio: '3 / 4' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Background image or fallback */}
        {hasPhoto ? (
          <img
            src={stop.photo_urls[0]}
            alt={stop.name}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gray-700" />
        )}

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-xl leading-none text-white"
        >
          ×
        </button>

        {/* Frosted bottom overlay */}
        <div
          className="absolute bottom-0 left-0 right-0 flex flex-col gap-3 p-5"
          style={{
            background:
              'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.55) 25%, rgba(0,0,0,0.82) 100%)',
            backdropFilter: 'blur(16px) saturate(0.9)',
            WebkitBackdropFilter: 'blur(16px) saturate(0.9)',
          }}
        >
          <div>
            <h2 className="text-2xl font-bold leading-tight text-white">
              {stop.name}
            </h2>
            {stop.description && (
              <p className="mt-2 text-sm leading-relaxed text-white/80">
                {stop.description}
              </p>
            )}
          </div>

          {(stop.is_accessible || stop.interest_tags.length > 0) && (
            <div className="flex flex-wrap gap-2">
              {stop.is_accessible && (
                <span className="rounded-full bg-blue-500/30 px-3 py-1 text-xs font-medium text-white">
                  &#x267F; Accessible
                </span>
              )}
              {stop.interest_tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-white/20 px-3 py-1 text-xs font-medium text-white"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          <button
            onClick={() =>
              window.open(
                `https://maps.google.com?q=${stop.lat},${stop.lng}`,
                '_blank',
              )
            }
            className="w-full rounded-2xl bg-white py-3.5 text-sm font-semibold text-gray-900"
          >
            Get directions
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

interface Props {
  stops: VisitorStop[];
  amenities: VisitorAmenity[];
  routes?: VisitorRoute[];
  primaryColor?: string;
}

export default function VisitorMap({
  stops,
  amenities,
  routes = [],
  primaryColor = '#2563eb',
}: Props) {
  const availableTypes = [...new Set(amenities.map((a) => a.type))];
  const [visibleTypes, setVisibleTypes] = useState<Set<AmenityType>>(
    new Set(availableTypes),
  );
  const [selectedStop, setSelectedStop] = useState<VisitorStop | null>(null);
  const [activeRouteId, setActiveRouteId] = useState<string | null>(null);

  function toggleType(type: AmenityType) {
    setVisibleTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }

  const activeRoute = routes.find((r) => r.id === activeRouteId) ?? null;

  const routeStops = useMemo<VisitorStop[]>(() => {
    if (!activeRoute) return stops;
    const byId = new Map(stops.map((s) => [s.id, s]));
    return activeRoute.stop_order
      .map((id) => byId.get(id))
      .filter((s): s is VisitorStop => s !== undefined);
  }, [activeRoute, stops]);

  const allItems = routeStops.map((s) => ({ lat: s.lat, lng: s.lng }));
  const visibleAmenities = amenities.filter((a) => visibleTypes.has(a.type));
  const polylinePositions: [number, number][] = activeRoute
    ? routeStops.map((s) => [s.lat, s.lng])
    : [];

  if (stops.length === 0 && amenities.length === 0) {
    return (
      <p className="text-center text-sm text-gray-400 mt-8">
        No map data available yet.
      </p>
    );
  }

  const center: [number, number] = stops[0]
    ? [stops[0].lat, stops[0].lng]
    : [amenities[0].lat, amenities[0].lng];

  return (
    <>
      <div className="flex flex-col gap-3">
        {/* Tours chip row */}
        {routes.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveRouteId(null)}
              className="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
              style={
                activeRouteId === null
                  ? {
                      borderColor: primaryColor,
                      backgroundColor: primaryColor,
                      color: 'white',
                    }
                  : {
                      borderColor: '#d1d5db',
                      backgroundColor: 'white',
                      color: '#4b5563',
                    }
              }
            >
              Explore
            </button>
            {routes.map((route) => {
              const active = route.id === activeRouteId;
              return (
                <button
                  key={route.id}
                  onClick={() => setActiveRouteId(route.id)}
                  className="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
                  style={
                    active
                      ? {
                          borderColor: primaryColor,
                          backgroundColor: primaryColor,
                          color: 'white',
                        }
                      : {
                          borderColor: '#d1d5db',
                          backgroundColor: 'white',
                          color: '#4b5563',
                        }
                  }
                >
                  {route.name}
                </button>
              );
            })}
          </div>
        )}

        {/* Active tour description */}
        {activeRoute && (
          <div
            className="flex items-start gap-3 rounded-xl border bg-white px-4 py-3 shadow-sm"
            style={{ borderColor: primaryColor }}
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900">
                {activeRoute.name}
              </p>
              {activeRoute.description && (
                <p className="mt-0.5 text-xs leading-snug text-gray-600">
                  {activeRoute.description}
                </p>
              )}
              <p className="mt-0.5 text-xs text-gray-400">
                {routeStops.length} stop{routeStops.length !== 1 ? 's' : ''}
              </p>
            </div>
            <button
              onClick={() => setActiveRouteId(null)}
              className="shrink-0 text-xs font-medium hover:underline"
              style={{ color: primaryColor }}
            >
              Clear
            </button>
          </div>
        )}

        {/* Amenity layer toggles */}
        {availableTypes.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {AMENITY_TYPES.filter((t) => availableTypes.includes(t.type)).map(
              ({ type, label }) => (
                <button
                  key={type}
                  onClick={() => toggleType(type)}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    visibleTypes.has(type)
                      ? 'border-gray-800 bg-gray-800 text-white'
                      : 'border-gray-300 bg-white text-gray-600'
                  }`}
                >
                  <span>{AMENITY_EMOJI[type]}</span>
                  {label}
                </button>
              ),
            )}
          </div>
        )}

        {/* Map */}
        <div className="h-[340px] overflow-hidden rounded-xl border border-gray-200 shadow-sm">
          <MapContainer center={center} zoom={14} className="h-full w-full">
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://openstreetmap.org">OSM</a>'
            />
            <FitBounds items={allItems} />

            {/* Tour polyline */}
            {activeRoute && polylinePositions.length > 1 && (
              <Polyline
                positions={polylinePositions}
                pathOptions={{ color: primaryColor, weight: 4, opacity: 0.85 }}
              />
            )}

            {/* Tour stops */}
            {routeStops.map((stop) => (
              <Marker key={stop.id} position={[stop.lat, stop.lng]}>
                <Popup maxWidth={200}>
                  <div className="flex flex-col gap-1.5">
                    {stop.photo_urls[0] && (
                      <img
                        src={stop.photo_urls[0]}
                        alt={stop.name}
                        className="w-full h-24 object-cover rounded"
                      />
                    )}
                    <strong className="text-sm">
                      {stop.name}
                      {stop.is_accessible && (
                        <span className="ml-1 text-blue-500" title="Accessible">
                          &#x267F;
                        </span>
                      )}
                    </strong>
                    <button
                      onClick={() => setSelectedStop(stop)}
                      className="mt-0.5 text-left text-xs font-medium text-blue-600 hover:underline"
                    >
                      See details →
                    </button>
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Amenity overlays */}
            {visibleAmenities.map((amenity) => (
              <Marker
                key={amenity.id}
                position={[amenity.lat, amenity.lng]}
                icon={amenityIcon(amenity.type)}
              >
                <Popup>
                  <strong className="text-sm">{amenity.name}</strong>
                  {amenity.notes && (
                    <p className="text-xs text-gray-600 mt-0.5">
                      {amenity.notes}
                    </p>
                  )}
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        {/* Stop list */}
        {routeStops.length > 0 && (
          <div className="flex flex-col divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white shadow-sm">
            {routeStops.map((stop) => (
              <button
                key={stop.id}
                onClick={() => setSelectedStop(stop)}
                className="flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 first:rounded-t-xl last:rounded-b-xl"
              >
                {/* Thumbnail */}
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                  {stop.photo_urls[0] ? (
                    <img
                      src={stop.photo_urls[0]}
                      alt={stop.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs font-bold text-gray-400">
                      {stop.name[0]}
                    </div>
                  )}
                </div>

                {/* Text */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {stop.name}
                  </p>
                  <p className="text-xs capitalize text-gray-400">
                    {stop.category}
                    {stop.is_accessible && (
                      <span className="ml-1 text-blue-500" title="Accessible">&#x267F;</span>
                    )}
                  </p>
                </div>

                {/* Chevron */}
                <svg
                  className="h-4 w-4 shrink-0 text-gray-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Stop detail card */}
      {selectedStop && (
        <StopCard stop={selectedStop} onClose={() => setSelectedStop(null)} />
      )}
    </>
  );
}
