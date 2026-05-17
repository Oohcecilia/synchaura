import PouchDB from "pouchdb/dist/pouchdb.js";

import { getDB, resetLocalDB } from "./couch";

import {
  isDBInitialized,
  markDBInitialized,
} from "./meta";

const API_URL = import.meta.env.VITE_API_URL;

let syncHandler = null;

export async function startSync({ id, onStatus, onProgress }) {
  const localDB = getDB(id);

  if (syncHandler) {
    return syncHandler;
  }

  const remoteDB = new PouchDB(`${API_URL}/couch`, {
    skip_setup: true,
  });

  const initialized = await isDBInitialized(localDB, id);

  if (!initialized) {
    onStatus?.("initializing");

    await new Promise((resolve, reject) => {
      localDB
        .replicate.from(remoteDB)
        .on("complete", async () => {
          await markDBInitialized(localDB, id);
          resolve();
        })
        .on("error", reject);
    });

    onStatus?.("ready");
  }

  syncHandler = localDB.sync(remoteDB, {
    live: true,
    retry: true,
  });

  syncHandler
    .on("active", () => onStatus?.("syncing"))
    .on("paused", () => onStatus?.("idle"))
    .on("change", (info) => {
      onProgress?.(Math.min(100, info.docs_read || 0));
    })
    .on("error", () => onStatus?.("error"));

  return syncHandler;
}

export function stopSync(id) {
  if (syncHandler) {
    syncHandler.cancel();
    syncHandler = null;
  }

  resetLocalDB(id);
}
