import { addDays, differenceInCalendarDays, differenceInCalendarMonths, differenceInCalendarWeeks, differenceInCalendarYears, format } from "date-fns";

const LOCAL_DATETIME_RE =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{3}))?)?$/;

export function parseLocalDateTime(value) {
  if (!value) return null;

  const match = String(value).match(LOCAL_DATETIME_RE);
  if (match) {
    const [, year, month, day, hour, minute, second = "0", millisecond = "0"] = match;
    const date = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
      Number(millisecond)
    );
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseTaskDate(value) {
  return parseLocalDateTime(value);
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
    normalizedEnd = addDays(end, 1);
  }

  const resolvedDue = normalizedEnd || due || start;

  return {
    start_date: start ? start.toISOString() : null,
    end_date: normalizedEnd ? normalizedEnd.toISOString() : null,
    due_date: resolvedDue ? resolvedDue.toISOString() : null,
  };
}

export function normalizeTaskCreationDateRange(input = {}) {
  const normalized = normalizeTaskDateRange(input);

  return {
    ...normalized,
    next_due_date:
      input.status === "recurring" && normalized.due_date
        ? normalized.due_date
        : null,
  };
}

const MAX_RECURRING_LOOKAHEAD_DAYS = 365 * 5;

const toNumberArray = (value) =>
  Array.isArray(value) ? value.map(Number).filter(Number.isFinite) : [];

const getRecurringReferenceDate = (task) =>
  parseTaskDate(
    task?.start_date ||
      task?.start_time ||
      task?.due_date ||
      task?.next_due_date ||
      task?.end_date ||
      task?.created_at
  );

const getRecurringDurationMs = (task) => {
  const start = parseTaskDate(task?.start_date || task?.start_time || task?.created_at);
  const endRaw = parseTaskDate(task?.end_date || task?.end_time || task?.due_date || task?.next_due_date);

  if (!start || !endRaw) return 0;

  const end = endRaw.getTime() <= start.getTime() ? addDays(endRaw, 1) : endRaw;
  return Math.max(0, end.getTime() - start.getTime());
};

export function isRecurringTaskOnDate(task, date) {
  if (task?.status !== "recurring") return false;

  const startDate = getRecurringReferenceDate(task);
  if (!startDate) return false;

  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const recurrenceStart = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());

  if (dayStart < recurrenceStart) return false;

  const count = Math.max(1, Number(task.recurring_interval_count) || 1);
  const interval = task.recurring_interval || "weekly";
  const daysOfWeek = toNumberArray(task.recurring_days_of_week);
  const daysOfMonth = toNumberArray(task.recurring_days_of_month);

  if (interval === "daily") {
    return differenceInCalendarDays(dayStart, recurrenceStart) % count === 0;
  }

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
}

export function getNextRecurringTaskDate(task, now = new Date()) {
  if (task?.status !== "recurring") return null;

  const reference = getRecurringReferenceDate(task);
  if (!reference) return null;

  const durationMs = getRecurringDurationMs(task);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  for (let offset = 0; offset <= MAX_RECURRING_LOOKAHEAD_DAYS; offset += 1) {
    const day = addDays(startOfToday, offset);
    if (!isRecurringTaskOnDate(task, day)) continue;

    const occurrenceStart = new Date(
      day.getFullYear(),
      day.getMonth(),
      day.getDate(),
      reference.getHours(),
      reference.getMinutes(),
      reference.getSeconds(),
      reference.getMilliseconds()
    );
    const occurrenceEnd = new Date(occurrenceStart.getTime() + durationMs);

    if (occurrenceEnd.getTime() >= now.getTime()) {
      return occurrenceEnd;
    }
  }

  const fallbackStart = new Date(
    startOfToday.getFullYear(),
    startOfToday.getMonth(),
    startOfToday.getDate(),
    reference.getHours(),
    reference.getMinutes(),
    reference.getSeconds(),
    reference.getMilliseconds()
  );

  return new Date(fallbackStart.getTime() + durationMs);
}

export function getTaskDeadlineDate(task) {
  if (task?.status === "recurring") {
    return getNextRecurringTaskDate(task) || parseTaskDate(task?.next_due_date);
  }

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
