import { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useAppData } from "@/lib/DataProvider";
import { createNotification } from "@/db/notification";
import React, { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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



export default function TaskFormDialog({
  open,
  onOpenChange,
  task,
  teams,
  members,
  workspaces,
  onSaved,
}) {
  const { isAuthenticated, session, setUser } = useAuth();

  // =============================
  const {
    loading,
    hasMembers,
    hasTeams
  } = useAppData();

  const [form, setForm] = useState({
    title: "",
    description: "",
    status: "today",
    priority: "medium",

    due_date: "",
    start_time: "",
    end_time: "",

    recurring_interval: "weekly",
    recurring_interval_count: 1,
    recurring_days_of_week: [],
    recurring_days_of_month: [],

    assigned_to: [],
    team_id: "",
    workspace_id: "",

    location_name: "",
    latitude: null,
    longitude: null,

    estimated_hours: "",
  });

  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const isEdit = !!task?._id;

  const safeToISOString = (value) => {
    if (!value) return null;

    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date.toISOString();
  };

  // -----------------------------
  // LOAD DATA
  // -----------------------------
  const formatDateTimeLocal = (value) => {
    if (!value) return "";

    const date = new Date(value);
    if (isNaN(date.getTime())) return ""; // 🛡 prevents crash

    return date.toISOString().slice(0, 16);
  };

  const isTimeOnly = (val) => /^\d{2}:\d{2}$/.test(val);


  useEffect(() => {
    if (!open) return;

    if (task) {
      setForm({
        title: task.title || "",
        description: task.description || "",
        status: task.status || "upcoming",
        priority: task.priority || "medium",

        due_date: formatDateTimeLocal(task.due_date),

        // ✅ Handle BOTH datetime and time-only safely
        start_date: isTimeOnly(task.start_date)
          ? task.start_date
          : formatDateTimeLocal(task.start_date),

        end_date: isTimeOnly(task.end_date)
          ? task.end_date
          : formatDateTimeLocal(task.end_date),

        recurring_interval: task.recurring_interval || "weekly",
        recurring_interval_count: task.recurring_interval_count || 1,

        recurring_days_of_week: task.recurring_days_of_week || [],
        recurring_days_of_month: task.recurring_days_of_month || [],

        assigned_to: task.assigned_to || [],
        team_id: task.team_id || "",
        workspace_id: task.workspace_id || "",

        location_name: task.location_name || "",
        latitude: task.latitude ?? null,
        longitude: task.longitude ?? null,

        estimated_hours: task.estimated_hours ?? "",
      });
    } else {
      setForm({
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

        location_name: "",
        latitude: null,
        longitude: null,

        estimated_hours: "",
      });
    }
  }, [task, open]);


  // -----------------------------
  // SUBMIT
  // -----------------------------


  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    console.log("user ",session?.userId);

    const db = getDB(session?.userId);
    if (!db) return;

    const safeParseFloat = (val) =>
      val !== "" && val !== null ? parseFloat(val) : null;

    const data = {
      ...form,

      due_date: form.due_date
        ? new Date(form.due_date).toISOString()
        : null,

      // ✅ FIXED
      start_time: form.start_time || null,
      end_time: form.end_time || null,

      latitude: safeParseFloat(form.latitude),
      longitude: safeParseFloat(form.longitude),

      estimated_hours: safeParseFloat(form.estimated_hours),

      recurring_interval_count:
        parseInt(form.recurring_interval_count) || 1,

      recurring_days_of_week: form.recurring_days_of_week || [],
      recurring_days_of_month: form.recurring_days_of_month || [],

      // ✅ FIXED
      next_due_date:
        form.status === "recurring" && form.due_date
          ? new Date(form.due_date).toISOString()
          : null,
    };

    try {
      let finalTaskDoc;

      if (task?._id) {
        const existingTask = await db.get(task._id);

        const wasCompleted =
          existingTask.status !== "completed" &&
          data.status === "completed";

        const assigneesChanged =
          JSON.stringify(existingTask.assigned_to || []) !==
          JSON.stringify(data.assigned_to || []);

        finalTaskDoc = {
          ...existingTask,
          ...data,
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
            created_by: session?.userId,
          },
          session?.userId
        );
      } else {
        finalTaskDoc = {
          _id: `task_${nanoid()}`,
          type: "task",
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
            created_by: session?.userId,
          },
          session?.userId
        );
      }

      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      console.error("❌ Save task error:", err);
    } finally {
      setSaving(false);
    }
  };

  // -----------------------------
  // FILTER TEAMS
  // -----------------------------
  const isPersonalWs = workspaces.filter(
    (ws) => {
      if (ws._id !== session?.userId) {
        return true;
      }
      return false;
    }
  );
  const filteredTeams = useMemo(() => {
    if (!form.workspace_id) return [];
    return (teams || []).filter((t) => t.workspace_id === form.workspace_id);
  }, [teams, form.workspace_id]);

  const safeTeamId =
    filteredTeams.some((t) => t._id === form.team_id)
      ? form.team_id
      : "";


  // -----------------------------
  // UI
  // -----------------------------
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{task?.id ? "Edit Task" : "New Task"}</DialogTitle>
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

          {/* Today: start time + end time (date fixed to today) */}
          {form.status === "today" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start Time</Label>
                <Input
                  type="time"
                  value={form.start_date ? form.start_date.slice(11, 16) : ""}
                  onChange={(e) => {
                    const today = new Date().toISOString().slice(0, 10);
                    setForm({ ...form, start_date: `${today}T${e.target.value}` });
                  }}
                />
              </div>
              <div>
                <Label>End Time</Label>
                <Input
                  type="time"
                  value={form.end_date ? form.end_date.slice(11, 16) : ""}
                  onChange={(e) => {
                    const today = new Date().toISOString().slice(0, 10);
                    setForm({ ...form, end_date: `${today}T${e.target.value}` });
                  }}
                />
              </div>
            </div>
          )}

          {/* Upcoming: start date + due date */}
          {form.status === "upcoming" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start Date</Label>
                <Input
                  type="datetime-local"
                  value={form.start_date ? form.start_date.slice(0, 10) : ""}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value ? `${e.target.value}T00:00` : "" })}
                />
              </div>
              <div>
                <Label>Due Date</Label>
                <Input
                  type="datetime-local"
                  value={form.due_date ? form.due_date.slice(0, 10) : ""}
                  onChange={(e) => setForm({ ...form, due_date: e.target.value ? `${e.target.value}T00:00` : "" })}
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
                    team_id: "" // 🔥 reset team when org changes
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a workspace" />
                </SelectTrigger>
                <SelectContent>
                  {(workspaces || []).map((ws) => (
                    <SelectItem key={ws._id} value={ws._id}>
                      {ws.name} {isPersonalWs && (<span className="text-[10px] italic tracking-wider ms-4">Personal</span>)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!isPersonalWs && !hasTeams &&  (
              <div>
                <Label>Team *</Label>

                <Select
                  value={safeTeamId}
                  onValueChange={(val) => {
                    if (val === "__create_team__") {
                      // handle create team action here
                      return;
                    }

                    setForm((prev) => ({
                      ...prev,
                      team_id: val,
                    }));
                  }}
                  disabled={!form.workspace_id} // 👈 disable when no org selected (your requirement)
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a team" />
                  </SelectTrigger>

                  <SelectContent>
                    {/* IF NO TEAMS */}
                    {(!teams || teams.length === 0) ? (
                      <SelectItem
                        value="__create_team__"
                        onPointerDown={(e) => {
                          e.preventDefault(); // Stop the Select from trying to "select" this
                          navigate('/teams?create=true');
                        }}
                      >
                        + Create new team
                      </SelectItem>
                    ) : (
                      <>
                        {filteredTeams.map((team) => (
                          <SelectItem key={team._id} value={team._id}>
                            {team.name}
                          </SelectItem>
                        ))}

                        {/* Optional CTA at bottom */}
                        <SelectItem
                          value="__create_team__"
                          onPointerDown={(e) => {
                            e.preventDefault(); // Stop the Select from trying to "select" this
                            navigate('/teams?create=true');
                          }}
                        >
                          + Create new team
                        </SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

          </div>


          {/* Assign Members */}
          {/* <div>
            <Label>Assign Members</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {(members || []).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggleMember(m.id)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                    form.assigned_to.includes(m.id)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted text-muted-foreground border-border hover:border-primary/50"
                  }`}
                >
                  {m.full_name || m.email}
                </button>
              ))}
              {(!members || members.length === 0) && (
                <p className="text-xs text-muted-foreground">No members available</p>
              )}
            </div>
          </div> */}

          {/* Estimated Hours */}
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

          {/* Location */}
          <div>
            <Label>Location</Label>
            <div className="mt-1">
              <LocationPicker
                value={{ location_name: form.location_name, latitude: form.latitude, longitude: form.longitude }}
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
              {saving && (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              )}
              {task?._id ? "Update" : "Create"}
            </Button>
          </div>

        </form>
      </DialogContent>
    </Dialog>
  );
}
