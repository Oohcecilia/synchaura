const isBrowser = typeof window !== "undefined";
const LOCAL_HOST_RE = /^(localhost|127\.0\.0\.1|::1)$/i;

const rawApiUrl = (import.meta.env.VITE_API_URL || "").trim().replace(/\/$/, "");

function isLocalUrl(value) {
  if (!value) return false;

  try {
    const parsed = new URL(value, isBrowser ? window.location.href : "http://localhost");
    return LOCAL_HOST_RE.test(parsed.hostname);
  } catch {
    return false;
  }
}

function resolveApiUrl() {
  if (!rawApiUrl) {
    return isBrowser ? `${window.location.origin}/api` : "/api";
  }

  if (isBrowser) {
    const pageIsLocal = LOCAL_HOST_RE.test(window.location.hostname);
    const apiIsLocal = isLocalUrl(rawApiUrl);

    if (!pageIsLocal && apiIsLocal) {
      return `${window.location.origin}/api`;
    }
  }

  return rawApiUrl;
}

export const API_URL = resolveApiUrl();

function getSessionToken() {
  try {
    const session = JSON.parse(localStorage.getItem("session") || "{}");
    return session?.token || null;
  } catch {
    return null;
  }
}

function joinApiPath(base, endpoint) {
  const normalizedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return `${base}${normalizedEndpoint}`;
}

export async function apiRequest(
  endpoint,
  {
    method = "GET",
    body,
    headers = {},
    requireAuth = true,
    timeoutMs = 12000,
  } = {}
) {
  try {
    if (!navigator.onLine) {
      throw new Error("OFFLINE");
    }

    const token = getSessionToken();
    const finalHeaders = {
      "Content-Type": "application/json",
      ...headers,
    };

    if (requireAuth && token) {
      finalHeaders.Authorization = `Bearer ${token}`;
    }

    const shouldUseTimeout = Number.isFinite(timeoutMs) && timeoutMs > 0;
    const controller = shouldUseTimeout ? new AbortController() : null;
    const timeoutId = shouldUseTimeout
      ? setTimeout(() => controller.abort(), timeoutMs)
      : null;

    let res;
    try {
      res = await fetch(joinApiPath(API_URL, endpoint), {
        method,
        headers: finalHeaders,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller?.signal,
      });
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }

    const text = await res.text();
    let data = {};

    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = {
          success: false,
          error: text,
          raw: text,
        };
      }
    }

    if (!res.ok) {
      const error = new Error(data?.error || data?.detail || "API request failed");
      error.status = res.status;
      throw error;
    }

    return data;
  } catch (err) {
    if (err.message === "OFFLINE") {
      return {
        success: false,
        offline: true,
        error: "No internet connection",
      };
    }

    if (err.name === "AbortError") {
      const timeoutError = new Error("Request timed out. Please try again.");
      timeoutError.status = 408;
      throw timeoutError;
    }

    throw err;
  }
}
