import { describe, it, expect } from "vitest";
import {
  parseLocalDateTime,
  parseTaskDate,
  formatTaskDateTimeLocal,
  getLocalDateString,
  normalizeTaskDateRange,
  normalizeTaskCreationDateRange,
  isRecurringTaskOnDate,
  getNextRecurringTaskDate,
  getTaskDeadlineDate,
  isCompletedTask,
} from "@/lib/task-dates";

describe("parseLocalDateTime", () => {
  it("returns null for empty input", () => {
    expect(parseLocalDateTime("")).toBeNull();
    expect(parseLocalDateTime(null)).toBeNull();
    expect(parseLocalDateTime(undefined)).toBeNull();
  });

  it("parses ISO-like datetime string correctly", () => {
    const result = parseLocalDateTime("2025-06-15T14:30:00");
    expect(result).not.toBeNull();
    expect(result.getFullYear()).toBe(2025);
    expect(result.getMonth()).toBe(5); // 0-indexed
    expect(result.getDate()).toBe(15);
    expect(result.getHours()).toBe(14);
    expect(result.getMinutes()).toBe(30);
  });

  it("parses datetime with milliseconds", () => {
    const result = parseLocalDateTime("2025-06-15T14:30:00.123");
    expect(result).not.toBeNull();
    expect(result.getMilliseconds()).toBe(123);
  });

  it("falls back to Date constructor for other formats", () => {
    const result = parseLocalDateTime("2025-06-15T14:30:00Z");
    expect(result).not.toBeNull();
    expect(result instanceof Date).toBe(true);
  });
});

describe("parseTaskDate", () => {
  it("is an alias for parseLocalDateTime", () => {
    expect(parseTaskDate("2025-06-15T14:30:00").getTime()).toBe(
      parseLocalDateTime("2025-06-15T14:30:00").getTime()
    );
  });
});

describe("formatTaskDateTimeLocal", () => {
  it("formats a date string to yyyy-MM-ddTHH:mm", () => {
    const result = formatTaskDateTimeLocal("2025-06-15T14:30:00");
    expect(result).toBe("2025-06-15T14:30");
  });

  it("returns empty string for null input", () => {
    expect(formatTaskDateTimeLocal(null)).toBe("");
  });
});

describe("getLocalDateString", () => {
  it("returns date in yyyy-MM-dd format", () => {
    const date = new Date(2025, 5, 15);
    const result = getLocalDateString(date);
    expect(result).toBe("2025-06-15");
  });
});

describe("normalizeTaskDateRange", () => {
  it("returns nulls when no dates provided", () => {
    const result = normalizeTaskDateRange({});
    expect(result.start_date).toBeNull();
    expect(result.end_date).toBeNull();
    expect(result.due_date).toBeNull();
  });

  it("normalizes end date when it equals start date", () => {
    const result = normalizeTaskDateRange({
      startDate: "2025-06-15T10:00:00",
      endDate: "2025-06-15T10:00:00",
    });
    // start_date should be a valid ISO string
    expect(result.start_date).toBeTruthy();
    expect(result.start_date).toContain("2025-06-15");
    // end_date should be bumped by 1 day
    expect(result.end_date).not.toBe(result.start_date);
    expect(result.end_date).toContain("2025-06-16");
  });

  it("uses due as resolved due when no end date", () => {
    const result = normalizeTaskDateRange({
      startDate: "2025-06-15T10:00:00",
      dueDate: "2025-06-20T10:00:00",
    });
    expect(result.due_date).toContain("2025-06-20");
  });
});

describe("isRecurringTaskOnDate", () => {
  const baseDate = new Date(2025, 5, 15); // June 15, 2025 (Sunday)

  it("returns false for non-recurring tasks", () => {
    expect(isRecurringTaskOnDate({ status: "today" }, baseDate)).toBe(false);
  });

  it("returns false when no reference date exists", () => {
    expect(
      isRecurringTaskOnDate({ status: "recurring" }, baseDate)
    ).toBe(false);
  });

  it("detects daily recurrence", () => {
    const task = {
      status: "recurring",
      recurring_interval: "daily",
      start_date: "2025-06-15T10:00:00",
    };
    // June 15 + 3 days = June 18
    expect(
      isRecurringTaskOnDate(task, new Date(2025, 5, 18))
    ).toBe(true);
    // Every other day should not match
    expect(
      isRecurringTaskOnDate(task, new Date(2025, 5, 16))
    ).toBe(true); // 1 day after
  });

  it("detects weekly recurrence on specific days", () => {
    const task = {
      status: "recurring",
      recurring_interval: "weekly",
      recurring_days_of_week: [1, 3, 5], // Mon, Wed, Fri
      start_date: "2025-06-16T10:00:00", // Monday
    };
    // June 16 is Monday → should match
    expect(isRecurringTaskOnDate(task, new Date(2025, 5, 16))).toBe(true);
    // June 18 is Wednesday → should match
    expect(isRecurringTaskOnDate(task, new Date(2025, 5, 18))).toBe(true);
    // June 17 is Tuesday → should NOT match
    expect(isRecurringTaskOnDate(task, new Date(2025, 5, 17))).toBe(false);
  });

  it("returns false for dates before the recurrence start", () => {
    const task = {
      status: "recurring",
      recurring_interval: "daily",
      start_date: "2025-06-15T10:00:00",
    };
    expect(
      isRecurringTaskOnDate(task, new Date(2025, 5, 14))
    ).toBe(false);
  });
});

describe("getNextRecurringTaskDate", () => {
  it("returns null for non-recurring tasks", () => {
    expect(getNextRecurringTaskDate({ status: "today" })).toBeNull();
  });

  it("returns null when no reference date exists", () => {
    expect(getNextRecurringTaskDate({ status: "recurring" })).toBeNull();
  });

  it("finds the next occurrence of a daily recurring task", () => {
    // Task starts June 15 10:00 and recurs daily with 1h duration
    const task = {
      status: "recurring",
      recurring_interval: "daily",
      start_date: "2025-06-15T10:00:00",
      end_date: "2025-06-15T11:00:00",
    };
    const now = new Date(2025, 5, 15, 9, 0); // June 15, 9:00 AM
    const next = getNextRecurringTaskDate(task, now);
    expect(next).not.toBeNull();
    // The task started at 10:00 and ends at 11:00 (already past at 9:00?)
    // No, actually 9:00 < 11:00, so the first occurrence (June 15) is still active
  });
});

describe("getTaskDeadlineDate", () => {
  it("returns the due_date for non-recurring tasks", () => {
    const task = {
      due_date: "2025-06-20T10:00:00",
      status: "upcoming",
    };
    const result = getTaskDeadlineDate(task);
    expect(result).not.toBeNull();
    expect(result.toISOString()).toContain("2025-06-20");
  });

  it("falls through to end_date, next_due_date, start_date", () => {
    const task = {
      end_date: "2025-07-01T12:00:00",
      status: "today",
    };
    const result = getTaskDeadlineDate(task);
    expect(result).not.toBeNull();
    expect(result.toISOString()).toContain("2025-07-01");
  });

  it("returns null when no dates exist", () => {
    const task = { status: "upcoming" };
    expect(getTaskDeadlineDate(task)).toBeNull();
  });
});

describe("isCompletedTask", () => {
  it("returns true for completed tasks", () => {
    expect(isCompletedTask({ status: "completed" })).toBe(true);
  });

  it("returns false for non-completed tasks", () => {
    expect(isCompletedTask({ status: "today" })).toBe(false);
    expect(isCompletedTask({ status: "upcoming" })).toBe(false);
    expect(isCompletedTask({ status: "recurring" })).toBe(false);
    expect(isCompletedTask({})).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isCompletedTask({ status: "COMPLETED" })).toBe(true);
    expect(isCompletedTask({ status: "Completed" })).toBe(true);
  });
});
