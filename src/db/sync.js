import PouchDB from "pouchdb/dist/pouchdb.js";

import { getDB, resetLocalDB } from "./couch";

import {
  isDBInitialized,
  markDBInitialized,
} from "./meta";

const VITE_POUCHDB_ROOT_URL = import.meta.env.VITE_POUCHDB_ROOT_URL;
const VITE_AUTH_STRING = import.meta.env.VITE_AUTH_STRING;
const VITE_DB_NAME = import.meta.env.VITE_DB_NAME;

let syncHandler = null;

export async function startSync({ id, onStatus, onProgress }) {
  const localDB = getDB(id);

  if (syncHandler) {
    return syncHandler;
  }

  const remoteDB = new PouchDB(
    `${VITE_POUCHDB_ROOT_URL}/${VITE_DB_NAME}`,
    {
      skip_setup: true,
      fetch: (url, opts) => {
        opts.headers.set(
          "Authorization",
          `Basic ${btoa(VITE_AUTH_STRING)}`
        );
        return PouchDB.fetch(url, opts);
      },
    }
  );

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
