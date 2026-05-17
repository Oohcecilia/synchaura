const API_URL = import.meta.env.VITE_API_URL;

function getSessionToken() {
  try {
    const session = JSON.parse(localStorage.getItem("session") || "{}");
    return session?.token || localStorage.getItem("token") || null;
  } catch {
    return localStorage.getItem("token") || null;
  }
}

export async function apiRequest(
  endpoint,
  { method = "GET", body, headers = {}, requireAuth = true } = {}
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

    const res = await fetch(`${API_URL}${endpoint}`, {
      method,
      headers: finalHeaders,
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    const data = text ? JSON.parse(text) : {};

    if (!res.ok) {
      throw new Error(data?.error || data?.detail || "API request failed");
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

    throw err;
  }
}
