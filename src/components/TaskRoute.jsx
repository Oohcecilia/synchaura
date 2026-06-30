import { useEffect, useMemo } from "react";
import { Polyline, useMap } from "react-leaflet";
import { Loader2, Route, Navigation } from "lucide-react";

/**
 * Converts seconds to a human-readable duration string.
 */
function formatDuration(seconds) {
  if (seconds == null) return "";
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
}

/**
 * Converts meters to a human-readable distance string.
 */
function formatDistance(meters) {
  if (meters == null) return "";
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Renders a navigation route on the map as a styled polyline.
 * Shows distance and duration in a floating summary card.
 * Fits the map bounds to show the entire route whenever the route
 * coordinates change (handles task switching correctly).
 *
 * Must be rendered inside a <MapContainer> to access the map instance.
 */
export default function TaskRoute({
  route,
  distance,
  duration,
  loading,
  error,
}) {
  const map = useMap();

  // Extract coordinates from GeoJSON route (GeoJSON: [lng,lat] → Leaflet: [lat,lng])
  const coordinates = useMemo(() => {
    if (!route) return [];
    try {
      const coords = route.features?.[0]?.geometry?.coordinates;
      if (!coords) return [];
      return coords.map(([lng, lat]) => [lat, lng]);
    } catch {
      return [];
    }
  }, [route]);

  // Fit map bounds to show the entire route whenever coordinates change
  useEffect(() => {
    if (coordinates.length > 0) {
      try {
        const bounds = coordinates.reduce(
          (acc, [lat, lng]) => ({
            minLat: Math.min(acc.minLat, lat),
            maxLat: Math.max(acc.maxLat, lat),
            minLng: Math.min(acc.minLng, lng),
            maxLng: Math.max(acc.maxLng, lng),
          }),
          { minLat: Infinity, maxLat: -Infinity, minLng: Infinity, maxLng: -Infinity }
        );

        map.fitBounds(
          [
            [bounds.minLat, bounds.minLng],
            [bounds.maxLat, bounds.maxLng],
          ],
          { padding: [60, 60], duration: 0.8 }
        );
      } catch {
        // Ignore bounds fitting errors
      }
    }
  }, [coordinates, map]);

  // Loading indicator
  if (loading) {
    return (
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] bg-card border rounded-full px-4 py-2 shadow-lg flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <span className="text-sm font-medium">Calculating route...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] bg-destructive/10 border border-destructive/30 rounded-full px-4 py-2 shadow-lg">
        <span className="text-xs text-destructive font-medium">{error}</span>
      </div>
    );
  }

  // Route available — render polyline + summary card
  if (coordinates.length > 0) {
    return (
      <>
        {/* Route polyline */}
        <Polyline
          positions={coordinates}
          pathOptions={{
            color: "#3b82f6",
            weight: 5,
            opacity: 0.8,
            lineCap: "round",
            lineJoin: "round",
          }}
        />

        {/* Distance and duration summary card */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] bg-card border rounded-xl px-4 py-2.5 shadow-lg flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Route className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">{formatDistance(distance)}</span>
          </div>
          <div className="w-px h-4 bg-border" />
          <div className="flex items-center gap-2">
            <Navigation className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">{formatDuration(duration)}</span>
          </div>
        </div>
      </>
    );
  }

  return null;
}
