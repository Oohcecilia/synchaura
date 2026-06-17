import { useState, useEffect, useRef, useCallback } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  useMapEvents,
  useMap,
} from "react-leaflet";
import { Input } from "@/components/ui/input";
import { Search, MapPin, X } from "lucide-react";
import { ensureLeafletDefaultIcons } from "@/lib/leaflet-icons";

ensureLeafletDefaultIcons();

const DEFAULT_CENTER = [12.8797, 121.774];
const DEFAULT_ZOOM = 6;

function ClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function FlyTo({ lat, lng }) {
  const map = useMap();

  useEffect(() => {
    if (lat != null && lng != null) {
      map.flyTo([lat, lng], 14, { duration: 1 });
    }
  }, [lat, lng, map]);

  return null;
}

export default function LocationPicker({ value, onChange }) {
  const [search, setSearch] = useState(value?.location_name || "");
  const [suggestions, setSuggestions] = useState([]);
  const [flyTarget, setFlyTarget] = useState(null);
  const debounceRef = useRef(null);

  const lat = value?.latitude;
  const lng = value?.longitude;

  const hasCoords = lat !== null && lat !== undefined && lng !== null && lng !== undefined;

  const center = hasCoords ? [lat, lng] : DEFAULT_CENTER;
  const zoom = hasCoords ? 14 : DEFAULT_ZOOM;

  useEffect(() => {
    setSearch(value?.location_name || "");
  }, [value?.location_name]);

  const fetchSuggestions = useCallback(async (q) => {
    if (!q || q.length < 3) {
      setSuggestions([]);
      return;
    }

    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
        q
      )}&format=json&limit=5`,
      { headers: { "Accept-Language": "en" } }
    );

    const data = await res.json();
    setSuggestions(data);
  }, []);

  const handleSearchChange = (e) => {
    const q = e.target.value;
    setSearch(q);

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(q);
    }, 400);
  };

  const selectSuggestion = (item) => {
    const newLat = parseFloat(item.lat);
    const newLng = parseFloat(item.lon);

    const name = item.display_name
      .split(",")
      .slice(0, 2)
      .join(", ");

    setSearch(name);
    setSuggestions([]);

    setFlyTarget({ lat: newLat, lng: newLng });

    onChange({
      location_name: name,
      latitude: newLat,
      longitude: newLng,
    });
  };

  const handleMapClick = (newLat, newLng) => {
    fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${newLat}&lon=${newLng}&format=json`,
      { headers: { "Accept-Language": "en" } }
    )
      .then((r) => r.json())
      .then((data) => {
        const name = data.display_name
          ? data.display_name.split(",").slice(0, 2).join(", ")
          : `${newLat.toFixed(5)}, ${newLng.toFixed(5)}`;

        setSearch(name);

        onChange({
          location_name: name,
          latitude: newLat,
          longitude: newLng,
        });
      })
      .catch(() => {
        const name = `${newLat.toFixed(5)}, ${newLng.toFixed(5)}`;

        setSearch(name);

        onChange({
          location_name: name,
          latitude: newLat,
          longitude: newLng,
        });
      });
  };

  const clearLocation = () => {
    setSearch("");
    setSuggestions([]);

    onChange({
      location_name: "",
      latitude: null,
      longitude: null,
    });
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />

        <Input
          value={search}
          onChange={handleSearchChange}
          placeholder="Search for a location..."
          className="pl-8 pr-8"
        />

        {search && (
          <button
            type="button"
            onClick={clearLocation}
            className="absolute right-2.5 top-1/2 -translate-y-1/2"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}

        {suggestions.length > 0 && (
          <div className="absolute z-[1000] top-full left-0 right-0 mt-1 bg-popover border rounded-lg shadow-lg">
            {suggestions.map((item) => (
              <button
                key={item.place_id}
                type="button"
                onClick={() => selectSuggestion(item)}
                className="w-full text-left px-3 py-2 text-xs hover:bg-muted flex gap-2"
              >
                <MapPin className="h-3.5 w-3.5 mt-0.5" />
                {item.display_name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="relative z-0 rounded-xl overflow-hidden border h-52">
        <MapContainer
          center={center}
          zoom={zoom}
          className="h-full w-full relative z-0"
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <ClickHandler onMapClick={handleMapClick} />

          {hasCoords && <FlyTo lat={lat} lng={lng} />}
          {flyTarget && <FlyTo lat={flyTarget.lat} lng={flyTarget.lng} />}

          {hasCoords && <Marker position={[lat, lng]} />}
        </MapContainer>
      </div>

      {hasCoords && (
        <p className="text-xs text-muted-foreground">
          {lat.toFixed(5)}, {lng.toFixed(5)}
        </p>
      )}
    </div>
  );
}
