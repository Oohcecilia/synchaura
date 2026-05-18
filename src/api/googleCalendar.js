import { apiRequest } from "@/api/client";

export async function getGoogleCalendarStatus() {
  return apiRequest("/google-calendar/status");
}

export async function getGoogleCalendarAuthUrl() {
  return apiRequest("/google-calendar/auth-url");
}

export async function disconnectGoogleCalendar() {
  return apiRequest("/google-calendar/disconnect", { method: "POST" });
}

export async function getGoogleCalendars() {
  return apiRequest("/google-calendar/calendars");
}

export async function getGoogleEvents({ timeMin, timeMax, calendarIds }) {
  const params = new URLSearchParams({ timeMin, timeMax });
  if (calendarIds?.length) params.set("calendarIds", calendarIds.join(","));
  return apiRequest(`/google-calendar/events?${params.toString()}`);
}

export async function createGoogleEvent(payload) {
  return apiRequest("/google-calendar/events", {
    method: "POST",
    body: payload,
  });
}

export async function updateGoogleEvent(calendarId, eventId, payload) {
  return apiRequest(
    `/google-calendar/events/${encodeURIComponent(calendarId)}/${encodeURIComponent(eventId)}`,
    {
      method: "PUT",
      body: payload,
    }
  );
}

export async function deleteGoogleEvent(calendarId, eventId) {
  return apiRequest(
    `/google-calendar/events/${encodeURIComponent(calendarId)}/${encodeURIComponent(eventId)}`,
    { method: "DELETE" }
  );
}
