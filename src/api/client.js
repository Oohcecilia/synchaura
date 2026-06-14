const rawApiUrl = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export const API_URL = rawApiUrl
  ? rawApiUrl.endsWith("/api")
    ? rawApiUrl
    : `${rawApiUrl}/api`
  : "/api";

function getSessionToken() {
  try {
    const session = JSON.parse(localStorage.getItem("session") || "{}");
    return session?.token || null;
  } catch {
    return null;
  }
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
    const shouldUseTimeout = Number.isFinite(timeoutMs) && timeoutMs > 0;
    const controller = shouldUseTimeout ? new AbortController() : null;
    const timeout = shouldUseTimeout
      ? setTimeout(() => controller.abort(), timeoutMs)
      : null;

    const finalHeaders = {
      "Content-Type": "application/json",
      ...headers,
    };

    if (requireAuth && token) {
      finalHeaders.Authorization = `Bearer ${token}`;
    }

    let res;
    try {
      res = await fetch(`${API_URL}${endpoint}`, {
        method,
        headers: finalHeaders,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller?.signal,
      });
    } finally {
      if (timeout) clearTimeout(timeout);
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
