import { useEffect } from "react";
import { getDB } from "@/db/couch";

const getUserId = (user) => {
  if (!user) return null;
  if (typeof user === "string") return user;
  return user.userId || user.id || user._id || null;
};

export default function usePouchChanges(user, callback, type) {
  const userId = getUserId(user);

  useEffect(() => {
    if (!userId) return;

    const db = getDB(userId);
    if (!db) return;

    const changes = db
      .changes({
        live: true,
        since: "now",
        include_docs: true,
      })
      .on("change", (change) => {
        const doc = change.doc;

        if (!doc) return;

        if (!type || doc?.type === type || doc?._deleted) {
          callback(doc);
        }
      })
      .on("error", console.error);

    return () => changes.cancel();
  }, [userId, type, callback]);
}
