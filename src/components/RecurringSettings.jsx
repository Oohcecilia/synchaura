import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

const INTERVALS = [
  { value: "daily",   label: "Day(s)" },
  { value: "weekly",  label: "Week(s)" },
  { value: "monthly", label: "Month(s)" },
  { value: "yearly",  label: "Year(s)" },
];

const DAYS_OF_WEEK = [
  { value: 0, label: "Su" },
  { value: 1, label: "Mo" },
  { value: 2, label: "Tu" },
  { value: 3, label: "We" },
  { value: 4, label: "Th" },
  { value: 5, label: "Fr" },
  { value: 6, label: "Sa" },
];

const MONTHS_OF_YEAR = [
  "Jan","Feb","Mar","Apr","May","Jun",
  "Jul","Aug","Sep","Oct","Nov","Dec"
];

// Days 1-31
const DAYS_OF_MONTH = Array.from({ length: 31 }, (_, i) => i + 1);

function ToggleChip({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "text-[11px] font-semibold px-2 py-1 rounded-lg border transition-all",
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-muted text-muted-foreground border-border hover:border-primary/50"
      )}
    >
      {label}
    </button>
  );
}

function toggleItem(arr, val) {
  return arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val].sort((a, b) => a - b);
}

export default function RecurringSettings({ form, setForm }) {
  const interval = form.recurring_interval || "weekly";
  const daysOfWeek = form.recurring_days_of_week || [];
  const daysOfMonth = form.recurring_days_of_month || [];

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-primary">
        <RefreshCw className="h-4 w-4" />
        Recurring Schedule
      </div>

      {/* Interval selector only */}
      <div>
        <Label className="text-xs">Interval</Label>
        <Select
          value={interval}
          onValueChange={(v) => setForm((p) => ({
            ...p,
            recurring_interval: v,
            recurring_days_of_week: [],
            recurring_days_of_month: [],
          }))}
        >
          <SelectTrigger className="mt-1"><SelectValue placeholder="Select..." /></SelectTrigger>
          <SelectContent>
            {INTERVALS.map((i) => (
              <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Weekly: pick days of week */}
      {interval === "weekly" && (
        <div>
          <Label className="text-xs">On these days</Label>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {DAYS_OF_WEEK.map((d) => (
              <ToggleChip
                key={d.value}
                label={d.label}
                active={daysOfWeek.includes(d.value)}
                onClick={() => setForm((p) => ({ ...p, recurring_days_of_week: toggleItem(daysOfWeek, d.value) }))}
              />
            ))}
          </div>
        </div>
      )}

      {/* Monthly: pick days of month */}
      {interval === "monthly" && (
        <div>
          <Label className="text-xs">On these days of the month</Label>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {DAYS_OF_MONTH.map((d) => (
              <ToggleChip
                key={d}
                label={String(d)}
                active={daysOfMonth.includes(d)}
                onClick={() => setForm((p) => ({ ...p, recurring_days_of_month: toggleItem(daysOfMonth, d) }))}
              />
            ))}
          </div>
        </div>
      )}

      {/* Yearly: pick months + days of month */}
      {interval === "yearly" && (
        <div className="space-y-3">
          <div>
            <Label className="text-xs">In these months</Label>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {MONTHS_OF_YEAR.map((m, idx) => (
                <ToggleChip
                  key={idx}
                  label={m}
                  active={daysOfWeek.includes(idx + 1)}
                  onClick={() => setForm((p) => ({ ...p, recurring_days_of_week: toggleItem(daysOfWeek, idx + 1) }))}
                />
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs">On these days of the month</Label>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {DAYS_OF_MONTH.map((d) => (
                <ToggleChip
                  key={d}
                  label={String(d)}
                  active={daysOfMonth.includes(d)}
                  onClick={() => setForm((p) => ({ ...p, recurring_days_of_month: toggleItem(daysOfMonth, d) }))}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Start time / End time (time only, no date) */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Start Time</Label>
          <Input
            type="time"
            value={form.start_date ? form.start_date.slice(11, 16) : ""}
            onChange={(e) => {
              const base = form.start_date ? form.start_date.slice(0, 10) : "1970-01-01";
              setForm((p) => ({ ...p, start_date: `${base}T${e.target.value}` }));
            }}
            className="mt-1"
          />
        </div>
        <div>
          <Label className="text-xs">
            End Time{" "}
            <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Input
            type="time"
            value={form.end_date ? form.end_date.slice(11, 16) : ""}
            onChange={(e) => {
              const base = form.end_date ? form.end_date.slice(0, 10) : "1970-01-01";
              setForm((p) => ({ ...p, end_date: `${base}T${e.target.value}` }));
            }}
            className="mt-1"
          />
        </div>
      </div>
    </div>
  );
}