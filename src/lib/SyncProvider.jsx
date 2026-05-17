import { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { startSync, stopSync } from "@/db/sync";
import SyncIndicator from "@/components/SyncIndicator";
import { getDB } from "@/db/couch";
import { isInitialized, markInitialized } from "@/db/meta";

const SYNC_TIMEOUT_MS = 30000;

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Initial sync timed out")), ms);
    }),
  ]);
}

export default function SyncProvider({ children }) {
  const { isAuthenticated, session } = useAuth();
  const [status, setStatus] = useState("idle");
  const [showSync, setShowSync] = useState(null);

  useEffect(() => {
    if (!isAuthenticated || !session?.userId) {
      setShowSync(false);
      return;
    }

    let alive = true;

    async function init() {
      let db;

      try {
        db = getDB(session.userId);
        const exists = await isInitialized(db);

        if (!alive) return;

        if (exists) {
          setShowSync(false);
          await startSync({
            id: session.userId,
            onStatus: setStatus,
          });
          return;
        }

        setShowSync(true);
        setStatus("initializing");

        await withTimeout(
          startSync({
            id: session.userId,
            onStatus: setStatus,
          }),
          SYNC_TIMEOUT_MS
        );

        await markInitialized(db);
      } catch (err) {
        console.error("Initial sync failed:", err);
        setStatus("error");

        // Do not block the whole app forever. The live sync layer retries in
        // the background, and users can still use the local database offline.
        if (db) {
          try {
            await markInitialized(db);
          } catch (markErr) {
            console.error("Failed to mark DB initialized after sync error:", markErr);
          }
        }
      } finally {
        if (alive) setShowSync(false);
      }
    }

    init();

    return () => {
      alive = false;
      stopSync(session.userId);
    };
  }, [isAuthenticated, session?.userId]);

  if (showSync === null) return children;

  return (
    <>
      <SyncIndicator visible={showSync} status={status} />
      {!showSync && children}
    </>
  );
}
