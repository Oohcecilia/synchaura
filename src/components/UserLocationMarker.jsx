import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

/**
 * A Leaflet marker that displays the user's current location as a pulsing
 * blue circle. Optionally flies the map to the user's position on first
 * detection via the `flyTo` prop.
 *
 * Must be rendered inside a <MapContainer>.
 */
export default function UserLocationMarker({ position, flyTo = false }) {
  const map = useMap();
  const markerRef = useRef(null);
  const hasFlownRef = useRef(false);

  useEffect(() => {
    if (!position) return;

    const { lat, lng } = position;

    // Inject the pulsing animation CSS once
    if (!document.getElementById("user-location-style")) {
      const style = document.createElement("style");
      style.id = "user-location-style";
      style.textContent = `
        @keyframes user-location-pulse {
          0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4); }
          70% { box-shadow: 0 0 0 12px rgba(59, 130, 246, 0); }
          100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
        }
      `;
      document.head.appendChild(style);
    }

    // Build the blue dot icon
    const markerIcon = L.divIcon({
      className: "",
      html: `<div style="
        width: 16px;
        height: 16px;
        background: #3b82f6;
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 0 4px rgba(0,0,0,0.3);
        animation: user-location-pulse 2s infinite;
      "></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });

    // Remove previous marker if it exists
    if (markerRef.current) {
      map.removeLayer(markerRef.current);
    }

    // Create and add the new marker
    const marker = L.marker([lat, lng], {
      icon: markerIcon,
      zIndexOffset: 1000,
    });
    marker.addTo(map);
    markerRef.current = marker;

    // Fly to user location on first detection
    if (flyTo && !hasFlownRef.current) {
      map.flyTo([lat, lng], 14, { duration: 1.5 });
      hasFlownRef.current = true;
    }

    return () => {
      if (markerRef.current) {
        map.removeLayer(markerRef.current);
        markerRef.current = null;
      }
    };
  }, [position, map, flyTo]);

  return null;
}
