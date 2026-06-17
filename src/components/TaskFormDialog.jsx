import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/lib/AuthContext";
import { createNotification } from "@/db/notification";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import LocationPicker from "@/components/LocationPicker";
import RecurringSettings from "@/components/RecurringSettings";
import { Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getDB } from "@/db/couch";
import { nanoid } from "nanoid";
import {
  normalizeTaskCreationDateRange,
  formatTaskDateTimeLocal,
  getLocalDateString,
} from "@/lib/task-dates";

const emptyForm = {
  title: "",
  description: "",
  status: "today",
  priority: "medium",
  due_date: "",
  start_date: "",
  end_date: "",
  recurring_interval: "weekly",
  recurring_interval_count: 1,
  recurring_days_of_week: [],
  recurring_days_of_month: [],
  assigned_to: [],
  team_id: "",
  workspace_id: "",
  due_alarm_enabled: true,
  location_name: "",
  latitude: null,
  longitude: null,
  estimated_hours: "",
};

const safeParseFloat = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? null : parsed;
};

export default function TaskFormDialog({
  open,
  onOpenChange,
  task,
  teams = [],
  members = [],
  workspaces = [],
  onSaved,
}) {
  const { session } = useAuth();
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;

    if (!task) {
      setForm(emptyForm);
      return;
    }

    setForm({
      ...emptyForm,
      title: task.title || "",
      description: task.description || "",
      status: task.status || "upcoming",
      priority: task.priority || "medium",
      due_date: formatTaskDateTimeLocal(task.due_date || task.end_date || task.next_due_date),
      start_date: formatTaskDateTimeLocal(task.start_date || task.start_time),
      end_date: formatTaskDateTimeLocal(task.end_date || task.end_time),
      recurring_interval: task.recurring_interval || "weekly",
      recurring_interval_count: task.recurring_interval_count || 1,
      recurring_days_of_week: task.recurring_days_of_week || [],
      recurring_days_of_month: task.recurring_days_of_month || [],
      assigned_to: task.assigned_to || [],
      team_id: task.team_id || "",
      workspace_id: task.workspace_id || "",
      due_alarm_enabled: task.due_alarm_enabled ?? true,
      location_name: task.location_name || "",
      latitude: task.latitude ?? null,
      longitude: task.longitude ?? null,
      estimated_hours: task.estimated_hours ?? "",
    });
  }, [task, open]);

  const selectedWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace._id === form.workspace_id),
    [workspaces, form.workspace_id]
  );

  const isPersonalWorkspace = selectedWorkspace?.account_type === "personal";

  const filteredTeams = useMemo(() => {
    if (!form.workspace_id) return [];
    return teams.filter((team) => team.workspace_id === form.workspace_id);
  }, [teams, form.workspace_id]);

  const safeTeamId = filteredTeams.some((team) => team._id === form.team_id)
    ? form.team_id
    : "";

  const setTodayTime = (field, value) => {
    if (!value) {
      setForm((prev) => ({ ...prev, [field]: "" }));
      return;
    }

    const today = getLocalDateString();
    setForm((prev) => ({ ...prev, [field]: `${today}T${value}` }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!session?.userId) return;

    setSaving(true);

    try {
      const db = getDB(session.userId);
      const normalizedDates = normalizeTaskCreationDateRange({
        status: form.status,
        startDate: form.start_date,
        endDate: form.end_date,
        dueDate: form.due_date,
      });

      const data = {
        ...form,
        due_alarm_enabled: form.due_alarm_enabled !== false,
        due_date: normalizedDates.due_date,
        start_date: normalizedDates.start_date,
        end_date: normalizedDates.end_date,
        latitude: safeParseFloat(form.latitude),
        longitude: safeParseFloat(form.longitude),
        estimated_hours: safeParseFloat(form.estimated_hours),
        recurring_interval_count: parseInt(form.recurring_interval_count, 10) || 1,
        recurring_days_of_week: form.recurring_days_of_week || [],
        recurring_days_of_month: form.recurring_days_of_month || [],
        next_due_date: normalizedDates.next_due_date,
      };

      let finalTaskDoc;

      if (task?._id) {
        const existingTask = await db.get(task._id);
        const wasCompleted = existingTask.status !== "completed" && data.status === "completed";
        const assigneesChanged =
          JSON.stringify(existingTask.assigned_to || []) !==
          JSON.stringify(data.assigned_to || []);

        finalTaskDoc = {
          ...existingTask,
          ...data,
          created_by: existingTask.created_by || session.userId,
          type: "task",
          updated_at: new Date().toISOString(),
        };

        await db.put(finalTaskDoc);

        await createNotification(
          {
            type: wasCompleted
              ? "task_completed"
              : assigneesChanged
                ? "task_assigned"
                : "task_updated",
            title: wasCompleted
              ? "Task completed"
              : assigneesChanged
                ? "Task reassigned"
                : "Task updated",
            message: `"${data.title}" was updated.`,
            task_id: task._id,
            team_id: data.team_id,
            workspace_id: data.workspace_id,
            recipient_user_ids: data.assigned_to || [],
            created_by: session.userId,
          },
          session.userId
        );
      } else {
        finalTaskDoc = {
          _id: `task_${nanoid()}`,
          type: "task",
          created_by: session.userId,
          ...data,
          created_at: new Date().toISOString(),
        };

        await db.put(finalTaskDoc);

        await createNotification(
          {
            type: "task_created",
            title: "Task created",
            message: `New task "${data.title}" was created.`,
            task_id: finalTaskDoc._id,
            team_id: data.team_id,
            workspace_id: data.workspace_id,
            recipient_user_ids: data.assigned_to || [],
            created_by: session.userId,
          },
          session.userId
        );
      }

      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      console.error("Save task error:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{task?._id ? "Edit Task" : "New Task"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Title *</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
              placeholder="Task title..."
            />
          </div>

          <div>
            <Label>Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Describe the task..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="upcoming">Upcoming</SelectItem>
                  <SelectItem value="recurring">Recurring</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-muted/20 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label className="text-sm font-medium">Due date alarms</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Notify assignees when the task is due soon or overdue.
                </p>
              </div>
              <Switch
                checked={form.due_alarm_enabled !== false}
                onCheckedChange={(checked) => setForm({ ...form, due_alarm_enabled: checked })}
              />
            </div>
          </div>

          {form.status === "today" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start Time</Label>
                <Input
                  type="time"
                  value={form.start_date ? form.start_date.slice(11, 16) : ""}
                  onChange={(e) => setTodayTime("start_date", e.target.value)}
                />
              </div>
              <div>
                <Label>End Time</Label>
                <Input
                  type="time"
                  value={form.end_date ? form.end_date.slice(11, 16) : ""}
                  onChange={(e) => setTodayTime("end_date", e.target.value)}
                />
              </div>
            </div>
          )}

          {form.status === "upcoming" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start Date</Label>
                <Input
                  type="datetime-local"
                  value={form.start_date ? form.start_date.slice(0, 16) : ""}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                />
              </div>
              <div>
                <Label>Due Date</Label>
                <Input
                  type="datetime-local"
                  value={form.due_date ? form.due_date.slice(0, 16) : ""}
                  onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                />
              </div>
            </div>
          )}

          {form.status === "recurring" && (
            <RecurringSettings form={form} setForm={setForm} />
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Workspace *</Label>
              <Select
                value={form.workspace_id}
                onValueChange={(v) => {
                  setForm({
                    ...form,
                    workspace_id: v,
                    team_id: "",
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a workspace" />
                </SelectTrigger>
                <SelectContent>
                  {workspaces.map((ws) => (
                    <SelectItem key={ws._id} value={ws._id}>
                      {ws.name}
                      {ws.account_type === "personal" && (
                        <span className="text-[10px] italic tracking-wider ms-4">Personal</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {form.workspace_id && !isPersonalWorkspace && (
              <div>
                <Label>Team</Label>
                <Select
                  value={safeTeamId}
                  onValueChange={(val) => {
                    if (val === "__create_team__") return;
                    setForm((prev) => ({ ...prev, team_id: val }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a team" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredTeams.map((team) => (
                      <SelectItem key={team._id} value={team._id}>
                        {team.name}
                      </SelectItem>
                    ))}
                    <SelectItem
                      value="__create_team__"
                      onPointerDown={(e) => {
                        e.preventDefault();
                        navigate("/teams?create=true");
                      }}
                    >
                      + Create new team
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div>
            <Label>Estimated Hours</Label>
            <Input
              type="number"
              step="0.5"
              min="0"
              value={form.estimated_hours}
              onChange={(e) => setForm({ ...form, estimated_hours: e.target.value })}
              placeholder="e.g. 2.5"
            />
          </div>

          <div>
            <Label>Location</Label>
            <div className="mt-1">
              <LocationPicker
                value={{
                  location_name: form.location_name,
                  latitude: form.latitude,
                  longitude: form.longitude,
                }}
                onChange={({ location_name, latitude, longitude }) =>
                  setForm((prev) => ({ ...prev, location_name, latitude, longitude }))
                }
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>

            <Button
              type="submit"
              disabled={
                saving ||
                !form.title ||
                !form.status ||
                !form.priority ||
                !form.workspace_id
              }
              className="flex-1"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {task?._id ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
