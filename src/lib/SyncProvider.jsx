import { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { runInitialSync, startSync, stopSync } from "@/db/sync";
import SyncIndicator from "@/components/SyncIndicator";
import { getDB } from "@/db/couch";
import { isInitialized, hasUsableLocalData } from "@/db/meta";

export default function SyncProvider({ children }) {
  const { isAuthenticated, session } = useAuth();
  const [status, setStatus] = useState("idle");
  const [progress, setProgress] = useState(0);
  const [showSync, setShowSync] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !session?.userId) {
      setShowSync(false);
      setProgress(0);
      return;
    }

    let alive = true;

    async function initSync() {
      try {
        const db = getDB(session.userId);
        const initialized = await isInitialized(db);
        const hasLocalData = initialized || await hasUsableLocalData(db);
        const shouldShowInitialSync = !hasLocalData;

        if (!alive) return;

        if (shouldShowInitialSync) {
          setShowSync(true);
          setStatus("initializing");
          setProgress(5);

          try {
            await runInitialSync({
              id: session.userId,
              onStatus: (nextStatus) => {
                if (alive) setStatus(nextStatus);
              },
              onProgress: (nextProgress) => {
                if (alive) setProgress(nextProgress);
              },
            });

            if (alive) {
              setStatus("ready");
              setProgress(100);
              window.setTimeout(() => alive && setShowSync(false), 600);
            }
          } catch (err) {
            console.warn("Initial sync failed:", err);
            if (alive) {
              setStatus("error");
              setProgress(100);
              window.setTimeout(() => alive && setShowSync(false), 1500);
            }
          }
        } else {
          // Existing local DB: render local data immediately and sync silently.
          setShowSync(false);
          setProgress(0);
          setStatus("idle");
        }

        await startSync({
          id: session.userId,
          onStatus: (nextStatus) => {
            if (alive) setStatus(nextStatus);
          },
          onProgress: (nextProgress) => {
            if (alive) setProgress(nextProgress);
          },
        });
      } catch (err) {
        console.warn("Sync initialization failed:", err);
        if (alive) {
          setStatus("error");
          setShowSync(false);
        }
      }
    }

    initSync();

    return () => {
      alive = false;
      stopSync();
    };
  }, [isAuthenticated, session?.userId]);

  return (
    <>
      <SyncIndicator visible={showSync} status={status} progress={progress} />
      {children}
    </>
  );
}
