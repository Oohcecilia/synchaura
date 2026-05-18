import { useEffect, useState, useCallback } from "react";
import { CalendarDays, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  getGoogleCalendarStatus,
  getGoogleCalendarAuthUrl,
  disconnectGoogleCalendar,
  getGoogleCalendars,
  getGoogleEvents,
  createGoogleEvent,
  updateGoogleEvent,
  deleteGoogleEvent,
} from "@/api/googleCalendar";

const emptyForm = {
  calendar_id: "primary",
  summary: "",
  description: "",
  location: "",
  start: "",
  end: "",
  all_day: false,
};

const toInputDateTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 16);
};

export default function GoogleCalendarPanel({ range, onEventsChange, selectedDate }) {
  const [connected, setConnected] = useState(false);
  const [calendars, setCalendars] = useState([]);
  const [selectedCalendarIds, setSelectedCalendarIds] = useState(["primary"]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [openForm, setOpenForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const loadEvents = useCallback(async () => {
    if (!connected || !range?.timeMin || !range?.timeMax) return;
    try {
      setSyncing(true);
      setError("");
      const res = await getGoogleEvents({
        ...range,
        calendarIds: selectedCalendarIds.length ? selectedCalendarIds : ["primary"],
      });
      onEventsChange?.(res.events || []);
    } catch (err) {
      setError(err.message || "Failed to sync Google Calendar events");
    } finally {
      setSyncing(false);
    }
  }, [connected, range, selectedCalendarIds, onEventsChange]);

  const loadStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const status = await getGoogleCalendarStatus();
      setConnected(Boolean(status.connected));
      if (status.connected) {
        const calendarRes = await getGoogleCalendars();
        const items = calendarRes.calendars || [];
        setCalendars(items);
        if (items.length) setSelectedCalendarIds((prev) => prev.length ? prev : [items[0].id]);
      }
    } catch (err) {
      setError(err.message || "Failed to load Google Calendar status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
    const params = new URLSearchParams(window.location.search);
    if (params.get("googleCalendar") === "connected") setSuccess("Google Calendar connected successfully.");
    if (params.get("googleCalendar") === "error") setError("Google Calendar connection failed.");
  }, [loadStatus]);

  useEffect(() => {
    loadEvents();
    const id = window.setInterval(loadEvents, 5 * 60 * 1000);
    return () => window.clearInterval(id);
  }, [loadEvents]);

  const connect = async () => {
    try {
      setLoading(true);
      const res = await getGoogleCalendarAuthUrl();
      window.location.href = res.url;
    } catch (err) {
      setError(err.message || "Unable to start Google sign-in");
      setLoading(false);
    }
  };

  const disconnect = async () => {
    try {
      setLoading(true);
      await disconnectGoogleCalendar();
      setConnected(false);
      setCalendars([]);
      onEventsChange?.([]);
      setSuccess("Google Calendar disconnected.");
    } catch (err) {
      setError(err.message || "Failed to disconnect Google Calendar");
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    const start = new Date(selectedDate || new Date());
    start.setHours(9, 0, 0, 0);
    const end = new Date(start);
    end.setHours(10, 0, 0, 0);
    setEditingEvent(null);
    setForm({ ...emptyForm, calendar_id: selectedCalendarIds[0] || "primary", start: toInputDateTime(start), end: toInputDateTime(end) });
    setOpenForm(true);
  };

  const openEdit = (event) => {
    setEditingEvent(event);
    setForm({
      calendar_id: event.calendarId || "primary",
      summary: event.summary || "",
      description: event.description || "",
      location: event.location || "",
      start: toInputDateTime(event.start?.dateTime || event.start?.date),
      end: toInputDateTime(event.end?.dateTime || event.end?.date),
      all_day: Boolean(event.start?.date),
    });
    setOpenForm(true);
  };

  const save = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      if (editingEvent) {
        await updateGoogleEvent(editingEvent.calendarId, editingEvent.id, form);
        setSuccess("Google Calendar event updated.");
      } else {
        await createGoogleEvent(form);
        setSuccess("Google Calendar event created.");
      }
      setOpenForm(false);
      await loadEvents();
    } catch (err) {
      setError(err.message || "Failed to save Google Calendar event");
    } finally {
      setLoading(false);
    }
  };

  const remove = async () => {
    if (!editingEvent) return;
    try {
      setLoading(true);
      await deleteGoogleEvent(editingEvent.calendarId, editingEvent.id);
      setSuccess("Google Calendar event deleted.");
      setOpenForm(false);
      await loadEvents();
    } catch (err) {
      setError(err.message || "Failed to delete Google Calendar event");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card border rounded-2xl p-3 space-y-3 overflow-hidden">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold flex items-center gap-2"><CalendarDays className="h-4 w-4" /> Google Calendar</p>
          <p className="text-xs text-muted-foreground truncate">{connected ? "Connected and syncing periodically" : "Connect your Google account to sync events"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {connected && <Button size="sm" variant="outline" onClick={loadEvents} disabled={syncing}>{syncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}Sync</Button>}
          {connected && <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Event</Button>}
          <Button size="sm" variant={connected ? "outline" : "default"} onClick={connected ? disconnect : connect} disabled={loading}>{loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{connected ? "Disconnect" : "Connect"}</Button>
        </div>
      </div>

      {(error || success) && <div className={cn("text-xs rounded-xl border p-2", error ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700")}>{error || success}</div>}

      {connected && calendars.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {calendars.map((calendar) => {
            const selected = selectedCalendarIds.includes(calendar.id);
            return <button key={calendar.id} type="button" onClick={() => setSelectedCalendarIds((prev) => selected ? prev.filter((id) => id !== calendar.id) : [...prev, calendar.id])} className={cn("shrink-0 rounded-full border px-3 py-1 text-xs", selected ? "bg-primary text-primary-foreground border-primary" : "bg-background")}>{calendar.summary}</button>;
          })}
        </div>
      )}

      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingEvent ? "Edit Google Event" : "New Google Event"}</DialogTitle><DialogDescription>Changes sync with Google Calendar.</DialogDescription></DialogHeader>
          <form onSubmit={save} className="space-y-3">
            <div><Label>Calendar</Label><Select value={form.calendar_id} onValueChange={(value) => setForm({ ...form, calendar_id: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(calendars.length ? calendars : [{ id: "primary", summary: "Primary" }]).map((calendar) => <SelectItem key={calendar.id} value={calendar.id}>{calendar.summary}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Title</Label><Input required value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} /></div>
            <div><Label>Start</Label><Input type="datetime-local" required value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} /></div>
            <div><Label>End</Label><Input type="datetime-local" required value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} /></div>
            <div><Label>Location</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
            <div><Label>Description</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">{editingEvent && <Button type="button" variant="destructive" onClick={remove} disabled={loading}><Trash2 className="h-4 w-4 mr-2" />Delete</Button>}<Button type="button" variant="outline" className="sm:ml-auto" onClick={() => setOpenForm(false)}>Cancel</Button><Button type="submit" disabled={loading}>{loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{editingEvent ? "Update" : "Create"}</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export { GoogleCalendarPanel };
