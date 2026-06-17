import { format } from "date-fns";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function parseTaskDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatTaskDateTimeLocal(value) {
  const date = parseTaskDate(value);
  if (!date) return "";
  return format(date, "yyyy-MM-dd'T'HH:mm");
}

export function getLocalDateString(date = new Date()) {
  return format(date, "yyyy-MM-dd");
}

export function normalizeTaskDateRange({
  startDate,
  endDate,
  dueDate,
} = {}) {
  const start = parseTaskDate(startDate);
  const end = parseTaskDate(endDate);
  const due = parseTaskDate(dueDate);

  let normalizedEnd = end;
  if (start && end && end.getTime() <= start.getTime()) {
    normalizedEnd = new Date(end.getTime() + MS_PER_DAY);
  }

  const resolvedDue = normalizedEnd || due || start;

  return {
    start_date: start ? start.toISOString() : null,
    end_date: normalizedEnd ? normalizedEnd.toISOString() : null,
    due_date: resolvedDue ? resolvedDue.toISOString() : null,
  };
}

export function getTaskDeadlineDate(task) {
  return (
    parseTaskDate(task?.due_date) ||
    parseTaskDate(task?.end_date) ||
    parseTaskDate(task?.next_due_date) ||
    parseTaskDate(task?.start_date) ||
    parseTaskDate(task?.created_at)
  );
}

export function isCompletedTask(task) {
  return String(task?.status || "").toLowerCase() === "completed";
}
