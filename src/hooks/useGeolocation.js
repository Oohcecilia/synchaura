import { useState, useEffect, useCallback, useRef } from "react";

/**
 * Browser geolocation states
 */
const PERMISSION = {
  PROMPT: "prompt",
  GRANTED: "granted",
  DENIED: "denied",
  UNAVAILABLE: "unavailable",
};

/**
 * A hook that wraps the Geolocation API with full error handling.
 *
 * @returns {{
 *   position: { lat: number, lng: number } | null,
 *   loading: boolean,
 *   error: string | null,
 *   permissionState: string,
 *   refreshLocation: () => void,
 * }}
 */
export default function useGeolocation() {
  const [position, setPosition] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [permissionState, setPermissionState] = useState(PERMISSION.PROMPT);
  const watchIdRef = useRef(null);

  // Check initial permission state if the Permissions API is available
  useEffect(() => {
    if (!navigator.geolocation) {
      setPermissionState(PERMISSION.UNAVAILABLE);
      setError("Geolocation is not supported by this browser.");
      return;
    }

    // Check permission via Permissions API (not supported in all browsers)
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions
        .query({ name: "geolocation" })
        .then((result) => {
          setPermissionState(result.state);

          // Listen for permission changes
          result.addEventListener("change", () => {
            setPermissionState(result.state);
            if (result.state === PERMISSION.GRANTED) {
              refreshLocation();
            }
          });
        })
        .catch(() => {
          // Permissions API not available, will prompt on first request
        });
    }

    // Try to get initial position
    refreshLocation();

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  const refreshLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by this browser.");
      setPermissionState(PERMISSION.UNAVAILABLE);
      return;
    }

    setLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setPermissionState(PERMISSION.GRANTED);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setLoading(false);
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setPermissionState(PERMISSION.DENIED);
            setError("Location access was denied. Please enable location permissions in your browser settings.");
            break;
          case err.POSITION_UNAVAILABLE:
            setError("Location could not be determined. Check your GPS or try again later.");
            break;
          case err.TIMEOUT:
            setError("Location request timed out. Please try again.");
            break;
          default:
            setError("An unknown error occurred while getting your location.");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000, // Cache position for up to 1 minute
      }
    );
  }, []);

  return {
    position,
    loading,
    error,
    permissionState,
    refreshLocation,
  };
}
