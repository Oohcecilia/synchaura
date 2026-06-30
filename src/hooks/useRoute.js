import { useState, useCallback, useRef } from "react";
import { apiRequest } from "@/api/client";

/**
 * Hook to fetch a navigation route between two points using OpenRouteService
 * via the backend proxy. Uses a request counter to ignore stale responses
 * when the user rapidly switches between tasks.
 *
 * @returns {{
 *   route: object | null,
 *   distance: number | null,
 *   duration: number | null,
 *   loading: boolean,
 *   error: string | null,
 *   fetchRoute: (origin: {lat: number, lng: number}, dest: {lat: number, lng: number}) => Promise<void>,
 *   clearRoute: () => void,
 * }}
 */
export default function useRoute() {
  const [route, setRoute] = useState(null);
  const [distance, setDistance] = useState(null);
  const [duration, setDuration] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const requestIdRef = useRef(0);

  const clearRoute = useCallback(() => {
    requestIdRef.current++; // invalidate any in-flight request
    setRoute(null);
    setDistance(null);
    setDuration(null);
    setLoading(false);
    setError(null);
  }, []);

  const fetchRoute = useCallback(async (origin, dest) => {
    if (!origin || !dest) {
      clearRoute();
      return;
    }

    const requestId = ++requestIdRef.current;

    setLoading(true);
    setError(null);

    try {
      const data = await apiRequest("/routing", {
        method: "POST",
        body: {
          origin_lat: origin.lat,
          origin_lng: origin.lng,
          dest_lat: dest.lat,
          dest_lng: dest.lng,
          profile: "driving-car",
        },
      });

      // Ignore stale responses from previous requests
      if (requestId !== requestIdRef.current) return;

      setRoute(data.route);
      setDistance(data.summary?.distance ?? null);
      setDuration(data.summary?.duration ?? null);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;

      const message =
        err?.detail ||
        err?.message ||
        "Failed to fetch route";
      setError(message);
      setRoute(null);
      setDistance(null);
      setDuration(null);
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [clearRoute]);

  return {
    route,
    distance,
    duration,
    loading,
    error,
    fetchRoute,
    clearRoute,
  };
}
