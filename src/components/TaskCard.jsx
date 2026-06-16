import { Calendar, MapPin, Users, CheckCircle2, Clock, RefreshCw, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, isPast, isToday, differenceInHours } from "date-fns";

import { getDB } from "@/db/couch";
import { createNotification } from "@/db/notification";
import { useAuth } from "@/lib/AuthContext";


const priorityConfig = {
  high: { label: "High", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  medium: { label: "Medium", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  low: { label: "Low", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
};

const statusConfig = {
  upcoming: { label: "Upcoming", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  today: { label: "Today", className: "bg-primary/10 text-primary" },
  previous: { label: "Overdue", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  completed: { label: "Completed", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  recurring: { label: "Recurring", className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
};


function getDeadlineUrgency(due_date, status, end_time) {

  if (status === "completed") return null;

  const now = new Date();
  const due = new Date(due_date);

  // -----------------------------
  // 1. OVERDUE (date already passed)
  // -----------------------------
  if (due_date && isPast(due) && !isToday(due)) {
    return "overdue";
  }

  // -----------------------------
  // 2. TODAY LOGIC (includes end_time)
  // -----------------------------
  if (isToday(due)) {
    if (!end_time) return "today";

    const [h, m] = end_time.split(":").map(Number);

    const endDateTime = new Date(due);
    endDateTime.setHours(h, m, 0, 0);

    if (now > endDateTime) return "overdue";
    if (differenceInHours(endDateTime, now) <= 2) return "urgent";

    return "today";
  }

  // -----------------------------
  // 3. SOON (next 48h)
  // -----------------------------
  const hoursUntil = differenceInHours(due, now);
  if (hoursUntil <= 48) return "soon";

  return null;
}

const intervalLabel = (task) => {
  if (!task.recurring_interval) return null;
  const count = task.recurring_interval_count || 1;
  const map = { daily: "day", weekly: "week", monthly: "month", yearly: "year" };
  return count === 1 ? `Every ${map[task.recurring_interval]}` : `Every ${count} ${map[task.recurring_interval]}s`;
};





export default function TaskCard({ task, members, onClick, onComplete, onReopen }) {

  const { user, session } = useAuth();
  const userId = user?.id || user?._id || session?.userId;
  const priority = priorityConfig[task.priority] || priorityConfig.medium;
  const status = statusConfig[task.status] || statusConfig.upcoming;
  const assignedMembers = (task.assigned_to || [])
    .map((id) => members?.find((m) => m.id === id))
    .filter(Boolean);

  const urgency = getDeadlineUrgency(task.due_date, task.status, task.end_date);
  const isCompleted = task.status === "completed";

  const urgencyBorder = {
    overdue: "border-red-400 dark:border-red-600",
    today: "border-blue-300 dark:border-blue-500",
    soon: "border-amber-400 dark:border-amber-500",
  };


  const handleComplete = async (task) => {
    try {
      if (!userId) return;

      const db = getDB(userId);
      
      const updatedTask = {
        ...task,
        status: "completed",
        updated_at: new Date().toISOString(),
      };

      // Assuming 'db' is your PouchDB instance for tasks
      // PouchDB uses .put() directly on the instance, not a table string
      await db.put(updatedTask);

      await createNotification({
        type: "task_completed",
        title: "Task completed",
        message: `"${task.title}" was marked as completed.`,
        task_id: task._id,
        workspace_id: task.workspace_id ?? task.org_id ?? null,
        team_id: task.team_id ?? null,
        recipient_user_ids: task.assigned_to || [],
        created_by: userId,
      }, userId);

      window.dispatchEvent(
        new CustomEvent("route:changed", {
          detail: { route: window.location.pathname }
        })
      );
      window.dispatchEvent(new Event("notifications:changed"));

    } catch (err) {
      if (err.name === 'conflict') {
        console.error("Conflict: This task was updated elsewhere.");
      } else {
        console.error("Complete task failed:", err);
      }
    }
  };

  return (
    <div
      onClick={() => onClick?.(task)}
      className={cn(
        "bg-card border rounded-xl p-4 cursor-pointer transition-all duration-200 hover:shadow-lg hover:shadow-primary/5 group relative",
        urgency ? urgencyBorder[urgency] : "border-border hover:border-primary/20"
      )}
    >
      {urgency && urgency !== "completed" && (
        <div className={cn(
          "absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl",
          urgency === "overdue" && "bg-red-500",
          urgency === "today" && "bg-blue-400 ",
          urgency === "soon" && "bg-amber-400",
        )} />
      )}
      <div className="flex items-start justify-between gap-3">
        <h3 className={cn("text-sm font-semibold group-hover:text-primary transition-colors line-clamp-2", isCompleted && "line-through text-muted-foreground")}>
          {task.title}
        </h3>


        <div className="flex items-center gap-1.5 shrink-0">
          <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap", priority.className)}>
            {priority.label}
          </span>
          {task.status === "recurring" && (
            <span className="h-6 w-6 rounded-full flex items-center justify-center text-purple-500">
              <RefreshCw className="h-3.5 w-3.5" />
            </span>
          )}
          {!isCompleted && (
            <button
              onClick={(e) => { e.stopPropagation(); handleComplete(task); }}
              title="Mark this occurrence done"
              className="h-6 w-6 text-emerald-700 rounded-full flex items-center justify-center text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
            >
              <CheckCircle2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {task.description && (
        <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{task.description}</p>
      )}

      <div className="flex items-center gap-3 mt-3 flex-wrap">
        <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", status.className)}>
          {status.label}
        </span>

        {task.due_date && (
          <div className={cn(
            "flex items-center gap-1 text-xs",
            urgency === "overdue" && "text-red-600 font-medium",
            urgency === "today" && "text-amber-600 font-medium",
            urgency === "soon" && "text-blue-600 font-medium",
            !urgency && "text-muted-foreground"
          )}>
            {urgency === "today" ? <Clock className="h-3 w-3" /> : <Calendar className="h-3 w-3" />}
            {format(new Date(task.due_date), "MMM d")}
            {urgency === "overdue" && <span className="ml-0.5">· Overdue</span>}
            {urgency === "today" && <span className="ml-0.5">· Due today</span>}
            {urgency === "soon" && <span className="ml-0.5">· Due soon</span>}
          </div>
        )}

        {task.location_name && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />
            <span className="truncate max-w-[80px]">{task.location_name}</span>
          </div>
        )}
      </div>

      {task.status === "recurring" && intervalLabel(task) && (
        <div className="flex items-center gap-1 mt-2 text-[10px] font-medium text-purple-600 dark:text-purple-400">
          <RefreshCw className="h-3 w-3" />
          {intervalLabel(task)}
          {task.next_due_date && (
            <span className="text-muted-foreground font-normal ml-1">
              · next {format(new Date(task.next_due_date), "MMM d")}
            </span>
          )}
        </div>
      )}

      {isCompleted && task.recurring_interval && (
        <button
          onClick={(e) => { e.stopPropagation(); onReopen?.(task); }}
          className="mt-3 flex items-center gap-1.5 text-[11px] text-purple-600 dark:text-purple-400 hover:underline font-medium"
        >
          <RotateCcw className="h-3 w-3" />
          Reopen
        </button>
      )}

      {assignedMembers.length > 0 && (
        <div className="flex items-center gap-1.5 mt-3">
          <Users className="h-3 w-3 text-muted-foreground" />
          <div className="flex -space-x-2">
            {assignedMembers.slice(0, 3).map((m) => (
              <div
                key={m.id}
                className="h-6 w-6 rounded-full bg-primary/10 border-2 border-card flex items-center justify-center"
                title={m.full_name || m.email}
              >
                <span className="text-[9px] font-bold text-primary">
                  {(m.full_name || m.email || "?").charAt(0).toUpperCase()}
                </span>
              </div>
            ))}
            {assignedMembers.length > 3 && (
              <div className="h-6 w-6 rounded-full bg-muted border-2 border-card flex items-center justify-center">
                <span className="text-[9px] font-bold text-muted-foreground">
                  +{assignedMembers.length - 3}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


