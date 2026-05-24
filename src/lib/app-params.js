// src/lib/app-config.js

const isBrowser = typeof window !== "undefined";

// safe storage fallback
const storage = isBrowser
  ? window.localStorage
  : new Map();

// -------------------------
// Helpers
// -------------------------
const toSnakeCase = (str) =>
  str.replace(/([A-Z])/g, "_$1").toLowerCase();

const getStorage = (key, defaultValue = null) => {
  if (!isBrowser) return defaultValue;

  const value = storage.getItem(key);
  return value ?? defaultValue;
};

const setStorage = (key, value) => {
  if (!isBrowser) return;
  storage.setItem(key, value);
};

// -------------------------
// APP CONFIG (NEW VERSION)
// -------------------------
export const appConfig = {
  // App identity (your own system, not Base44)
  appName: "synchaura",

  // CouchDB server (change in production)
  couchUrl:
    import.meta.env.VITE_COUCH_URL ||
    "http://127.0.0.1:5984",

  // Local device ID (useful for offline sync tracking)
  deviceId:
    getStorage("device_id") ||
    (() => {
      const id = crypto.randomUUID();
      setStorage("device_id", id);
      return id;
    })(),

  // Auth token (your future PIN/login system)
  token: getStorage("auth_token"),

  setToken(token) {
    setStorage("auth_token", token);
  },

  clearToken() {
    if (!isBrowser) return;
    storage.removeItem("auth_token");
  },
};