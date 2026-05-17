import { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { startSync, stopSync } from "@/db/sync";
import SyncIndicator from "@/components/SyncIndicator";
import { getDB } from "@/db/couch";
import { isInitialized, markInitialized } from "@/db/meta";

export default function SyncProvider({ children }) {
  const { isAuthenticated, session } = useAuth();
  const [status, setStatus] = useState("idle");
  const [showSync, setShowSync] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !session?.userId) {
      setShowSync(false);
      return;
    }

    let alive = true;

    async function initSyncInBackground() {
      let db;

      try {
        db = getDB(session.userId);
        const exists = await isInitialized(db);

        if (!alive) return;

        // Local-first: never block app rendering on replication. Existing DBs
        // and first-run DBs both render immediately while sync runs/retries.
        setShowSync(false);
        setStatus(exists ? "idle" : "initializing");

        await startSync({
          id: session.userId,
          onStatus: (nextStatus) => {
            if (alive) setStatus(nextStatus);
          },
        });

        if (!exists && db) {
          await markInitialized(db);
        }
      } catch (err) {
        console.warn("Background sync failed:", err);
        if (alive) {
          setStatus("error");
          setShowSync(false);
        }

        if (db) {
          try {
            await markInitialized(db);
          } catch (markErr) {
            console.warn("Failed to mark DB initialized after sync error:", markErr);
          }
        }
      }
    }

    initSyncInBackground();

    return () => {
      alive = false;
      stopSync(session.userId);
    };
  }, [isAuthenticated, session?.userId]);

  return (
    <>
      <SyncIndicator visible={showSync} status={status} />
      {children}
    </>
  );
}
