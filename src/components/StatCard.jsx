import { cn } from "@/lib/utils";

export default function StatCard({ title, value, icon: Icon, trend, className }) {
  return (
    <div className={cn("bg-card border border-border rounded-2xl p-5 transition-all hover:shadow-lg hover:shadow-primary/5", className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
          <p className="text-3xl font-bold mt-2 tracking-tight">{value}</p>
          {trend !== 0 && (
            <p className={cn("text-xs font-medium mt-1", trend > 0 ? "text-emerald-500" : "text-destructive")}>
              {trend > 0 ? "+" : ""}{trend}% from last week
            </p>
          )}
        </div>
        {Icon && (
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        )}
      </div>
    </div>
  );
}