import { useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import { startOfWeek, addDays, format, isAfter, startOfDay, parseISO } from "date-fns";

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
    const dayName = format(day, "EEE");
    const ideal = Math.round(total - (total / 6) * i);
    const isFuture = isAfter(day, today);
    const completed = completedByDay(day);
    const remaining = total - completed;

    return {
      day: dayName,
      Ideal: ideal,
      Actual: isFuture ? null : remaining,
    };
  });
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((p) =>
        p.value != null ? (
          <p key={p.name} style={{ color: p.color }}>
            {p.name}: <span className="font-bold">{p.value} tasks</span>
          </p>
        ) : null
      )}
    </div>
  );
};

export default function BurndownChart({ tasks }) {
  const data = useMemo(() => buildBurndownData(tasks), [tasks]);
  const total = tasks.length;
  const completed = tasks.filter((t) => t.status === "completed").length;
  const remaining = total - completed;

  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold">Weekly Burndown</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Planned vs actual task completion</p>
        </div>
        <div className="flex gap-4 text-right">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Remaining</p>
            <p className="text-xl font-bold">{remaining}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Done</p>
            <p className="text-xl font-bold text-emerald-600">{completed}</p>
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
          <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line
            type="monotone"
            dataKey="Ideal"
            stroke="hsl(var(--muted-foreground))"
            strokeDasharray="5 5"
            strokeWidth={1.5}
            dot={false}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="Actual"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={{ r: 3, fill: "hsl(var(--primary))" }}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}