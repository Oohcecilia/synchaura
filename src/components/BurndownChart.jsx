import { useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import { startOfWeek, addDays, format, isAfter, startOfDay } from "date-fns";

function buildBurndownData(tasks) {
  const today = startOfDay(new Date());
  const weekStart = startOfWeek(today, { weekStartsOn: 1 }); // Monday

  // Total tasks to complete this week = all non-completed tasks + tasks completed this week
  const weekTasks = tasks.filter((t) => {
    if (t.status === "completed" && t.updated_date) {
      const d = startOfDay(new Date(t.updated_date));
      return d >= weekStart && d <= addDays(weekStart, 6);
    }
    return t.status !== "completed";
  });

  const total = tasks.length > 0 ? tasks.length : 0;

  // Ideal burndown: linear decrease from total → 0 over 5 workdays (Mon–Fri)
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Count tasks completed on or before each day
  const completedByDay = (day) =>
    tasks.filter((t) => {
      if (t.status !== "completed" || !t.updated_date) return false;
      return startOfDay(new Date(t.updated_date)) <= day;
    }).length;

  return days.map((day, i) => {
    const ideal = Math.max(0, total - (total / 6) * i);
    const actual = Math.max(0, total - completedByDay(day));

    return {
      day: format(day, "EEE"),
      ideal: Number(ideal.toFixed(1)),
      actual,
      isFuture: isAfter(day, today),
    };
  });
}

export default function BurndownChart({ tasks = [] }) {
  const data = useMemo(() => buildBurndownData(tasks), [tasks]);

  return (
    <div className="bg-card border rounded-2xl p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold">Weekly Burndown</h3>
        <p className="text-xs text-muted-foreground">Planned vs actual remaining tasks</p>
      </div>

      <div className="h-60">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="day" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="ideal" strokeDasharray="4 4" dot={false} name="Ideal" />
            <Line type="monotone" dataKey="actual" strokeWidth={2} name="Actual" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
