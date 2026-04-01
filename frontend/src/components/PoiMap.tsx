import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect } from "react";
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from "react-leaflet";

export interface MapItem {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

function FitBounds({ items }: { items: MapItem[] }) {
  const map = useMap();
  useEffect(() => {
    if (items.length === 0) return;
    if (items.length === 1) {
      map.setView([items[0].lat, items[0].lng], 13);
      return;
    }
    map.fitBounds(
      L.latLngBounds(items.map((i) => [i.lat, i.lng])),
      { padding: [30, 30] },
    );
  }, [items, map]);
  return null;
}

export default function PoiMap({ items }: { items: MapItem[] }) {
  const center: [number, number] = [items[0].lat, items[0].lng];
  return (
    <div className="sticky top-8 h-[500px] overflow-hidden rounded-xl border border-gray-200">
      <MapContainer center={center} zoom={12} className="h-full w-full" zoomControl>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://openstreetmap.org">OSM</a>'
        />
        <FitBounds items={items} />
        {items.map((item) => (
          <Marker key={item.id} position={[item.lat, item.lng]}>
            <Tooltip permanent direction="right">
              {item.name}
            </Tooltip>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
