import { useEffect, useState } from "react";
import { WifiOff, RefreshCw } from "lucide-react";

export default function NetworkStatusBanner() {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="mb-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 shadow-sm dark:text-amber-50">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-full bg-amber-500/15 p-2">
          <WifiOff className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Offline mode is active</p>
          <p className="mt-0.5 text-xs text-amber-900/80 dark:text-amber-100/80">
            You’re viewing cached workspace data. New changes stay local and will sync automatically when the connection returns.
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-1.5 rounded-full border border-amber-600/20 bg-white/70 px-3 py-1.5 text-xs font-semibold text-amber-950 transition hover:bg-white dark:bg-amber-950/20 dark:text-amber-50"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </button>
      </div>
    </div>
  );
}
