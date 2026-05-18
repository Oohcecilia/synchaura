import { useState, useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight, RefreshCw, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppData } from "@/lib/DataProvider";
import { cn } from "@/lib/utils";
import { getSavedTheme, applyTheme } from "@/utils/theme";
import GoogleCalendarPanel from "@/components/GoogleCalendarPanel";
import TaskDetailDialog from "../components/TaskDetailDialog";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
  differenceInCalendarDays,
  differenceInCalendarWeeks,
  differenceInCalendarMonths,
  differenceInCalendarYears,
} from "date-fns";
import TaskFormDialog from "../components/TaskFormDialog";

const googleEventStart = (event) => event.start?.dateTime || event.start?.date;

const getTaskStartDate = (task) => {
  const value = task.due_date || task.next_due_date || task.start_date || task.created_at;
  if (!value) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const toNumberArray = (value) => Array.isArray(value) ? value.map(Number).filter(Number.isFinite) : [];
const intervalCount = (task) => Math.max(1, Number(task.recurring_interval_count) || 1);

const isRecurringTaskOnDate = (task, date) => {
  if (task.status !== "recurring") return false;

  const startDate = getTaskStartDate(task);
  if (!startDate) return false;

  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const recurrenceStart = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());

  if (dayStart < recurrenceStart) return false;

  const count = intervalCount(task);
  const interval = task.recurring_interval || "weekly";
  const daysOfWeek = toNumberArray(task.recurring_days_of_week);
  const daysOfMonth = toNumberArray(task.recurring_days_of_month);

  if (interval === "daily") return differenceInCalendarDays(dayStart, recurrenceStart) % count === 0;

  if (interval === "weekly") {
    const weekMatches = differenceInCalendarWeeks(dayStart, recurrenceStart, { weekStartsOn: 1 }) % count === 0;
    const selectedDays = daysOfWeek.length ? daysOfWeek : [recurrenceStart.getDay()];
    return weekMatches && selectedDays.includes(dayStart.getDay());
  }

  if (interval === "monthly") {
    const monthMatches = differenceInCalendarMonths(dayStart, recurrenceStart) % count === 0;
    const selectedDates = daysOfMonth.length ? daysOfMonth : [recurrenceStart.getDate()];
    return monthMatches && selectedDates.includes(dayStart.getDate());
  }

  if (interval === "yearly") {
    const yearMatches = differenceInCalendarYears(dayStart, recurrenceStart) % count === 0;
    const selectedMonths = daysOfWeek.length ? daysOfWeek : [recurrenceStart.getMonth() + 1];
    const selectedDates = daysOfMonth.length ? daysOfMonth : [recurrenceStart.getDate()];
    return yearMatches && selectedMonths.includes(dayStart.getMonth() + 1) && selectedDates.includes(dayStart.getDate());
  }

  return false;
};

const createOccurrence = (task, date) => ({
  ...task,
  occurrence_date: date.toISOString(),
  occurrence_key: `${task._id}_${format(date, "yyyy-MM-dd")}`,
  is_recurring_occurrence: task.status === "recurring",
});

export default function CalendarPage() {
  const {
    tasks,
    teams,
    members,
    workspaces,
    loading,
  } = useAppData();

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [googleEvents, setGoogleEvents] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [detailTask, setDetailTask] = useState(null);

  useEffect(() => {
    applyTheme(getSavedTheme());
  }, []);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
    const result = [];
    let day = start;

    while (day <= end) {
      result.push(day);
      day = addDays(day, 1);
    }

    return result;
  }, [currentMonth]);

  const googleRange = useMemo(() => ({
    timeMin: startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 }).toISOString(),
    timeMax: endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 }).toISOString(),
  }), [currentMonth]);

  const getTasksForDate = (date) => {
    return (tasks ?? [])
      .flatMap((task) => {
        if (task.status === "recurring") {
          return isRecurringTaskOnDate(task, date)
            ? [createOccurrence(task, date)]
            : [];
        }

        if (!task.due_date) return [];

        const due = new Date(task.due_date);
        if (Number.isNaN(due.getTime())) return [];

        return isSameDay(due, date)
          ? [createOccurrence(task, date)]
          : [];
      })
      .sort((a, b) => String(a.start_date || a.due_date || "").localeCompare(String(b.start_date || b.due_date || "")));
  };

  const getGoogleEventsForDate = (date) =>
    (googleEvents || []).filter((event) => {
      const start = googleEventStart(event);
      return start && isSameDay(new Date(start), date);
    });

  const selectedTasks = selectedDate ? getTasksForDate(selectedDate) : [];
  const selectedGoogleEvents = selectedDate ? getGoogleEventsForDate(selectedDate) : [];

  const priorityDot = {
    high: "bg-red-500",
    medium: "bg-amber-500",
    low: "bg-emerald-500",
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 overflow-x-hidden">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Calendar</h1>
        <p className="text-sm text-muted-foreground mt-1">View tasks and Google Calendar events by date</p>
      </div>

      <GoogleCalendarPanel
        range={googleRange}
        selectedDate={selectedDate}
        onEventsChange={setGoogleEvents}
      />

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between p-3 md:p-4 border-b border-border">
          <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <h2 className="text-sm font-semibold">{format(currentMonth, "MMMM yyyy")}</h2>

          <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-7 border-b border-border">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="text-[10px] md:text-xs font-medium text-muted-foreground text-center py-2">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {days.map((day) => {
            const dayTasks = getTasksForDate(day);
            const dayGoogleEvents = getGoogleEventsForDate(day);
            const itemCount = dayTasks.length + dayGoogleEvents.length;
            const isSelected = selectedDate && isSameDay(day, selectedDate);

            return (
              <button
                key={day.toISOString()}
                onClick={() => setSelectedDate(day)}
                className={cn(
                  "min-h-[64px] md:min-h-[88px] p-1.5 border-b border-r border-border text-left transition-all relative overflow-hidden",
                  !isSameMonth(day, currentMonth) && "opacity-30",
                  isSelected && "bg-primary/5 ring-2 ring-primary ring-inset",
                  isToday(day) && "bg-primary/5"
                )}
              >
                <span className={cn("text-xs font-medium inline-flex h-6 w-6 items-center justify-center rounded-full", isToday(day) && "bg-primary text-primary-foreground")}>
                  {format(day, "d")}
                </span>

                <div className="flex flex-wrap gap-0.5 mt-0.5">
                  {dayTasks.slice(0, 3).map((task) => (
                    <div key={task.occurrence_key} className={cn("h-1.5 w-1.5 rounded-full", priorityDot[task.priority] || "bg-primary", task.is_recurring_occurrence && "ring-1 ring-primary ring-offset-1 ring-offset-background")} title={task.title} />
                  ))}
                  {dayGoogleEvents.slice(0, Math.max(0, 4 - dayTasks.length)).map((event) => (
                    <div key={`${event.calendarId}_${event.id}`} className="h-1.5 w-1.5 rounded-full bg-sky-500" title={event.summary} />
                  ))}
                  {itemCount > 4 && <span className="text-[8px] text-muted-foreground">+{itemCount - 4}</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {selectedDate && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Items for {format(selectedDate, "MMMM d, yyyy")}</h3>

          {selectedTasks.length === 0 && selectedGoogleEvents.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No tasks or events for this date</p>
          ) : (
            <div className="space-y-2">
              {selectedTasks.map((task) => (
                <div key={task.occurrence_key} onClick={() => setDetailTask(task)} className="bg-card border border-border rounded-xl p-3 cursor-pointer hover:shadow-md transition-all flex items-center gap-3 min-w-0">
                  <div className={cn("h-2 w-2 rounded-full shrink-0", priorityDot[task.priority] || "bg-primary")} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate flex items-center gap-1">
                      {task.title}
                      {task.is_recurring_occurrence && <RefreshCw className="h-3 w-3 text-primary shrink-0" />}
                    </p>
                    {task.is_recurring_occurrence && <p className="text-[10px] text-muted-foreground">Recurs on {format(new Date(task.occurrence_date), "MMM d, yyyy")}</p>}
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary shrink-0">{task.is_recurring_occurrence ? "recurring" : task.status}</span>
                </div>
              ))}
              {selectedGoogleEvents.map((event) => (
                <div key={`${event.calendarId}_${event.id}`} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3 min-w-0">
                  <div className="h-2 w-2 rounded-full bg-sky-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate flex items-center gap-1">{event.summary || "Untitled event"}<CalendarDays className="h-3 w-3 text-sky-500 shrink-0" /></p>
                    <p className="text-[10px] text-muted-foreground truncate">{event.start?.date ? "All day" : format(new Date(googleEventStart(event)), "h:mm a")}</p>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-600 shrink-0">Google</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <TaskDetailDialog
        open={!!detailTask}
        onOpenChange={(v) => !v && setDetailTask(null)}
        task={detailTask}
        members={members}
        onEdit={(task) => {
          setDetailTask(null);
          setEditTask(task);
          setShowForm(true);
        }}
      />

      <TaskFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        task={editTask}
        teams={teams}
        members={members}
        workspaces={workspaces}
      />
    </div>
  );
}
