import { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { startSync, stopSync } from "@/db/sync";
import SyncIndicator from "@/components/SyncIndicator";
import { getDB } from "@/db/couch";
import { isInitialized, markInitialized } from "@/db/meta";

export default function SyncProvider({ children }) {
  const { isAuthenticated, session } = useAuth();

  const [status, setStatus] = useState("idle");

  // 👇 IMPORTANT: null = "checking", false = no UI, true = show UI
  const [showSync, setShowSync] = useState(null);

  useEffect(() => {
    if (!isAuthenticated || !session?.userId) return;

    let alive = true;

    async function init() {
      const db = getDB(session.userId);

      // STEP 1: check DB first (NO UI)
      const exists = await isInitialized(db);

      if (!alive) return;

      // STEP 2: if already initialized → NO UI AT ALL
      if (exists) {
        setShowSync(false);
        return;
      }

      // STEP 3: first time → show sync UI
      setShowSync(true);

      await startSync({
        id: session.userId,
        onStatus: setStatus,
      });

      await markInitialized(db);

      if (!alive) return;

      setShowSync(false);
    }

    init();

    return () => {
      alive = false;
      stopSync(session.userId);
    };
  }, [isAuthenticated, session?.userId]);

  // 🚨 KEY: don't render anything until decision is made
  if (showSync === null) return children;

  return (
    <>
      <SyncIndicator visible={showSync} status={status} />
      {!showSync && children}
    </>
  );
}