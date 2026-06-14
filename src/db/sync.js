import PouchDB from "pouchdb/dist/pouchdb.js";

import { API_URL } from "@/api/client";
import { getDB } from "./couch";

import {
  isDBInitialized,
  markDBInitialized,
} from "./meta";

const INITIAL_SYNC_TIMEOUT_MS = 20000;

let syncHandler = null;
let activeUserId = null;

function withTimeout(promise, ms, message) {
  let timeoutId;

  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), ms);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

function createRemoteDB() {
  return new PouchDB(`${API_URL}/couch`, {
    skip_setup: true,
  });
}

export async function runInitialSync({ id, onStatus, onProgress }) {
  const localDB = getDB(id);
  const initialized = await isDBInitialized(localDB, id);

  if (initialized) {
    onProgress?.(100);
    return { initialized: true, skipped: true };
  }

  const remoteDB = createRemoteDB();
  onStatus?.("initializing");
  onProgress?.(5);

  await withTimeout(
    new Promise((resolve, reject) => {
      localDB
        .replicate.from(remoteDB)
        .on("change", (info) => {
          const docsRead = info.docs_read || 0;
          const pct = Math.min(95, 10 + docsRead * 5);
          onProgress?.(pct);
        })
        .on("complete", resolve)
        .on("error", reject);
    }),
    INITIAL_SYNC_TIMEOUT_MS,
    "Initial sync timed out"
  );

  await markDBInitialized(localDB, id);
  onStatus?.("ready");
  onProgress?.(100);

  return { initialized: true, skipped: false };
}

export async function startSync({ id, onStatus, onProgress }) {
  const localDB = getDB(id);

  if (syncHandler && activeUserId === id) {
    return syncHandler;
  }

  if (syncHandler) {
    syncHandler.cancel();
    syncHandler = null;
  }

  const remoteDB = createRemoteDB();
  activeUserId = id;

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

export function stopSync() {
  if (syncHandler) {
    syncHandler.cancel();
    syncHandler = null;
  }

  activeUserId = null;
}
