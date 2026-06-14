import { useEffect, useState, useRef } from "react";
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

  // prevent double execution
  const hasRunRef = useRef(false);
  const aliveRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || !session?.userId) {
      hasRunRef.current = false;
      setShowSync(false);
      setStatus("idle");
      setProgress(0);
      stopSync?.();
      return;
    }

    if (hasRunRef.current) return;
    hasRunRef.current = true;
    aliveRef.current = true;

    let cancelled = false;

    async function initSyncFlow() {
      try {
        const userId = session.userId;

        // IMPORTANT: DB creation is safe here, but we don't depend on side effects
        const db = getDB(userId);

        // run checks in parallel
        const [initialized, hasLocalData] = await Promise.all([
          isInitialized(db),
          hasUsableLocalData(db),
        ]);

        if (cancelled || !aliveRef.current) return;

        const isFirstTime = !initialized || !hasLocalData;

        // -----------------------------
        // CASE 1: FIRST TIME DEVICE
        // -----------------------------
        if (isFirstTime) {
          setShowSync(true);
          setStatus("initializing");
          setProgress(5);

          try {
            await runInitialSync({
              id: userId,
              onStatus: (s) => {
                if (!cancelled) setStatus(s);
              },
              onProgress: (p) => {
                if (!cancelled) setProgress(p);
              },
            });

            if (cancelled) return;

            setStatus("ready");
            setProgress(100);

            setTimeout(() => {
              if (!cancelled) setShowSync(false);
            }, 500);
        } catch (err) {
            if (!cancelled) {
              setStatus("error");
              setProgress(100);

              setTimeout(() => {
                if (!cancelled) setShowSync(false);
              }, 1200);
            }
          }
        }

        // -----------------------------
        // CASE 2: EXISTING DEVICE
        // -----------------------------
        else {
          setShowSync(false);
          setStatus("idle");
          setProgress(0);
        }

        // -----------------------------
        // ALWAYS: background sync
        // -----------------------------
        startSync({
          id: userId,
          onStatus: (s) => {
            if (!cancelled) setStatus(s);
          },
          onProgress: (p) => {
            if (!cancelled) setProgress(p);
          },
        });
      } catch (err) {
        if (!cancelled) {
          setStatus("error");
          setShowSync(false);
        }
      }
    }

    initSyncFlow();

    return () => {
      cancelled = true;
      aliveRef.current = false;
      stopSync?.();
    };
  }, [isAuthenticated, session?.userId]);

  return (
    <>
      {showSync && (
        <SyncIndicator
          visible={showSync}
          status={status}
          progress={progress}
        />
      )}
      {children}
    </>
  );
}





// export default function SyncProvider({ children }) {
//   const { isAuthenticated, session } = useAuth();
//   const [status, setStatus] = useState("idle");
//   const [progress, setProgress] = useState(0);
//   const [showSync, setShowSync] = useState(false);

//   useEffect(() => {
//     if (!isAuthenticated || !session?.userId) {
//       setShowSync(false);
//       setProgress(0);
//       return;
//     }

//     let alive = true;

//     async function initSync() {
//       try {
//         const db = getDB(session.userId);
//         const initialized = await isInitialized(db);
//         const hasLocalData = initialized || await hasUsableLocalData(db);

//         if (!alive) return;

//         if (hasLocalData) {
//           setShowSync(true);
//           setStatus("initializing");
//           setProgress(5);

//           try {
//             await runInitialSync({
//               id: session.userId,
//               onStatus: (nextStatus) => {
//                 if (alive) setStatus(nextStatus);
//               },
//               onProgress: (nextProgress) => {
//                 if (alive) setProgress(nextProgress);
//               },
//             });

//             if (alive) {
//               setStatus("ready");
//               setProgress(100);
//               window.setTimeout(() => alive && setShowSync(false), 600);
//             }
//           } catch (err) {
//             console.warn("Initial sync failed:", err);
//             if (alive) {
//               setStatus("error");
//               setProgress(100);
//               window.setTimeout(() => alive && setShowSync(false), 1500);
//             }
//           }
//         } else {
//           // Existing local DB: render local data immediately and sync silently.
//           setShowSync(false);
//           setProgress(0);
//           setStatus("idle");
//         }

//         await startSync({
//           id: session.userId,
//           onStatus: (nextStatus) => {
//             if (alive) setStatus(nextStatus);
//           },
//           onProgress: (nextProgress) => {
//             if (alive) setProgress(nextProgress);
//           },
//         });
//       } catch (err) {
//         console.warn("Sync initialization failed:", err);
//         if (alive) {
//           setStatus("error");
//           setShowSync(false);
//         }
//       }
//     }

//     initSync();

//     return () => {
//       alive = false;
//       stopSync();
//     };
//   }, [isAuthenticated, session?.userId]);

//   return (
//     <>
//       {showSync && (<SyncIndicator visible={showSync} status={status} progress={progress} />)}
//       {children}
//     </>
//   );
// }
