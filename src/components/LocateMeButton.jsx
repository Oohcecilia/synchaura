import { Target, Loader2 } from "lucide-react";

/**
 * A floating action button that triggers geolocation and centers the map
 * on the user's current location. Positioned at the bottom-right of the map.
 *
 * This is the UI-only shell. Map access and flyTo logic is handled by the
 * parent via the `onClick` callback, which receives the map instance.
 */
export default function LocateMeButton({ onClick, loading, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title="Show my location"
      className="absolute bottom-4 right-4 z-[1000] bg-card border rounded-full p-2.5 shadow-lg hover:shadow-xl hover:bg-accent transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : (
        <Target className="h-5 w-5 text-muted-foreground" />
      )}
    </button>
  );
}
