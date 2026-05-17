import {
  CheckCircle2,
  Loader2,
  Database,
  AlertCircle,
} from "lucide-react";

import { motion, AnimatePresence } from "framer-motion";

export default function SyncIndicator({
  visible,
  status,
}) {
  if (!visible) return null;

  const isDone = status === "ready";

  const getTitle = () => {
    switch (status) {
      case "initializing":
        return "Setting up your workspace";

      case "syncing":
        return "Keeping your data up to date";

      case "error":
        return "Something went wrong";

      case "ready":
        return "All set!";

      default:
        return "Getting things ready";
    }
  };

  const getDescription = () => {
    switch (status) {
      case "initializing":
        return "We’re preparing your offline workspace...";

      case "syncing":
        return "Syncing your latest updates...";

      case "error":
        return "Please check your connection and try again.";

      case "ready":
        return "You're ready to go offline.";

      default:
        return "Please wait a moment...";
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm"
      >
        <motion.div
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 28,
          }}
          className="w-full max-w-sm mx-4 bg-card border border-border rounded-2xl shadow-2xl p-8 flex flex-col items-center gap-6"
        >
          {/* ICON */}
          <div className="relative">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Database className="h-8 w-8 text-primary" />
            </div>

            {status !== "ready" && status !== "error" && (
              <div className="absolute -top-1 -right-1">
                <Loader2 className="h-5 w-5 text-primary animate-spin" />
              </div>
            )}

            {isDone && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-1 -right-1"
              >
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </motion.div>
            )}

            {status === "error" && (
              <div className="absolute -top-1 -right-1">
                <AlertCircle className="h-5 w-5 text-red-500" />
              </div>
            )}
          </div>

          {/* TEXT */}
          <div className="text-center space-y-1">
            <h2 className="text-lg font-semibold tracking-tight">
              {getTitle()}
            </h2>

            <p className="text-sm text-muted-foreground">
              {getDescription()}
            </p>
          </div>

          {/* PROGRESS (INDICATOR ONLY - NO %) */}
          <div className="w-full space-y-2">
            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden relative">
              <motion.div
                className="h-full bg-primary rounded-full absolute"
                initial={{ x: "-100%" }}
                animate={{ x: "100%" }}
                transition={{
                  repeat: Infinity,
                  duration: 1.2,
                  ease: "linear",
                }}
                style={{ width: "40%" }}
              />
            </div>

            <div className="text-xs text-center text-muted-foreground">
              {status === "initializing" &&
                "Preparing offline workspace..."}

              {status === "syncing" &&
                "Syncing changes..."}

              {status === "ready" &&
                "Everything is up to date"}

              {status === "error" &&
                "Sync failed"}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}