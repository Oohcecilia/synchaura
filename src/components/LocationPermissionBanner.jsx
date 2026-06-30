import { MapPinOff, ExternalLink } from "lucide-react";

/**
 * A subtle banner shown at the top of the map when the user's location
 * permission is denied or geolocation is unavailable.
 */
export default function LocationPermissionBanner({ permissionState }) {
  if (permissionState === "granted" || permissionState === "prompt") {
    return null;
  }

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] max-w-md w-full px-4">
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3 shadow-lg flex items-start gap-3">
        <MapPinOff className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
            {permissionState === "denied"
              ? "Location access is blocked"
              : "Location unavailable"}
          </p>
          <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">
            {permissionState === "denied"
              ? "Enable location permissions in your browser settings to see your current position and get navigation routes."
              : "Geolocation is not available on this device or browser."}
          </p>
          {permissionState === "denied" && (
            <button
              onClick={() => {
                window.open(
                  "https://support.google.com/chrome/answer/142065",
                  "_blank",
                  "noopener noreferrer"
                );
              }}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 mt-1.5 underline underline-offset-2"
            >
              Learn how to enable
              <ExternalLink className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
