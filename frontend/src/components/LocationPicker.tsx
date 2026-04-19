import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useRef, useState } from 'react';
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';

// Fix Leaflet default icon resolution in Vite
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

// Flies to new coordinates when they change; skips on initial mount
function MapController({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  const prev = useRef<[number, number] | null>(null);

  useEffect(() => {
    if (prev.current !== null && (prev.current[0] !== lat || prev.current[1] !== lng)) {
      map.flyTo([lat, lng], 15);
    }
    prev.current = [lat, lng];
  }, [lat, lng, map]);

  return null;
}

interface LocationPickerProps {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number, lng: number) => void;
}

export default function LocationPicker({ lat, lng, onChange }: LocationPickerProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [searching, setSearching] = useState(false);
  const markerRef = useRef<L.Marker>(null);
  // When a result is selected, we set query to the display name — skipSearch
  // prevents the useEffect from firing a redundant Nominatim search for that text.
  const skipSearch = useRef(false);

  useEffect(() => {
    if (skipSearch.current) {
      skipSearch.current = false;
      return;
    }
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const id = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`,
          { headers: { 'User-Agent': 'polypoi-admin' } },
        );
        setResults(await res.json());
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(id);
  }, [query]);

  function selectResult(r: NominatimResult) {
    skipSearch.current = true;
    onChange(parseFloat(r.lat), parseFloat(r.lon));
    setQuery(r.display_name);
    setResults([]);
  }

  function handleDragEnd() {
    const pos = markerRef.current?.getLatLng();
    if (pos) onChange(pos.lat, pos.lng);
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <input
          type="text"
          placeholder="Search for a location…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {searching && (
          <span className="absolute right-3 top-2.5 text-xs text-gray-400">Searching…</span>
        )}
        {results.length > 0 && (
          <ul className="absolute z-[1000] mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
            {results.map((r, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => selectResult(r)}
                  className="w-full px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg"
                >
                  {r.display_name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {lat !== null && lng !== null && (
        <>
          <div style={{ height: 180 }} className="overflow-hidden rounded-lg border border-gray-200">
            <MapContainer
              center={[lat, lng]}
              zoom={15}
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom={false}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <Marker
                position={[lat, lng]}
                draggable
                ref={markerRef}
                eventHandlers={{ dragend: handleDragEnd }}
              />
              <MapController lat={lat} lng={lng} />
            </MapContainer>
          </div>
          <p className="text-xs text-gray-400">
            {lat.toFixed(5)}, {lng.toFixed(5)} · drag pin to adjust
          </p>
        </>
      )}
    </div>
  );
}
