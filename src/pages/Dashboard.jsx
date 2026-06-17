import { useEffect, useState, useMemo } from "react";
import { useAppData } from "@/lib/DataProvider";
import { Link } from "react-router-dom";
import {
  CheckSquare,
  Clock,
  AlertTriangle,
  Users,
  Plus,
  ArrowRight,
  TrendingUp,
  Settings
} from "lucide-react";
import { Button } from "@/components/ui/button";

import StatCard from "@/components/StatCard";
import TaskCard from "@/components/TaskCard";
import BurndownChart from "@/components/BurndownChart";
import TaskFormDialog from "@/components/TaskFormDialog";
import TaskDetailDialog from "@/components/TaskDetailDialog";
import EmptyState from "@/components/EmptyState";

import { isToday, isPast, isFuture } from "date-fns";
import { getSavedTheme, applyTheme } from "@/utils/theme";
import { isCompletedTask } from "@/lib/task-dates";

export default function Dashboard() {
  // =============================
  // GLOBAL DATA
  // =============================
  const {
    tasks,
    teams,
    members,
    workspaces,
    loading,
    reload,
    hasMembers,
    hasTeams
  } = useAppData();

  // =============================
  // LOCAL STATE
  // =============================

  const [detailTask, setDetailTask] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editTask, setEditTask] = useState(null);

  const [, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("theme");
    return saved ? saved === "dark" : false;
  });

  // =============================
  // THEME INIT (RUN ONCE)
  // =============================
  useEffect(() => {
    const theme = getSavedTheme();
    setDarkMode(applyTheme(theme));
  }, []);

  // =============================
  // SAFE DATA NORMALIZATION
  // =============================
  const safeTasks = useMemo(() => tasks ?? [], [tasks]);
  const visibleTasks = useMemo(
    () => safeTasks.filter((task) => !isCompletedTask(task)),
    [safeTasks]
  );

  // =============================
  // FILTERS (optimized + safe)
  // =============================
  const todayTasks = useMemo(() => {
    return visibleTasks.filter((t) => {
      const due = t.due_date ? new Date(t.due_date) : null;

      return (
        t.status === "today" ||
        (due && isToday(due))
      );
    });
  }, [visibleTasks]);

  const upcomingTasks = useMemo(() => {
    return visibleTasks.filter((t) => {
      const due = t.due_date ? new Date(t.due_date) : null;

      return (
        t.status === "upcoming" &&
        (!due || isFuture(due))
      );
    });
  }, [visibleTasks]);

  const overdueTasks = useMemo(() => {
    return visibleTasks.filter((t) => {
      const due = t.due_date ? new Date(t.due_date) : null;

      return (
        t.status === "previous" ||
        (due &&
          isPast(due) &&
          t.status !== "completed" &&
          !isToday(due))
      );
    });
  }, [safeTasks]);

  // -----------------------------
  // LOADING STATE
  // -----------------------------
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // -----------------------------
  // UI
  // -----------------------------
  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="sticky top-0 z-20 -mx-4 border-b border-border/0 bg-background/95 px-4 py-3 backdrop-blur-sm sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="pr-12 sm:pr-0">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Overview of your workspace
          </p>
          </div>

          <Link to="/settings" className="absolute right-0 top-0 sm:static">
            <Button
              variant="outline"
              className="rounded-xl h-10 w-10 p-0 sm:h-auto sm:w-auto sm:p-2"
              aria-label="Dashboard settings"
            >
              <Settings className="h-5 w-5 sm:h-6 sm:w-6" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Tasks" value={visibleTasks.length} icon={CheckSquare} trend={0} className />
        <StatCard title="Today" value={todayTasks.length} icon={Clock} trend={0} className />
        {hasTeams && (<StatCard title="Overdue" value={overdueTasks.length} icon={AlertTriangle} trend={0} className />)}
        <StatCard title="Teams" value={teams.length} icon={Users} trend={0} className />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Button
          variant="outline"
          className="rounded-xl h-auto py-3 justify-start"
          onClick={() => {
            setEditTask(null);
            setShowForm(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2 text-primary" />
          <span className="text-xs font-medium">Add Task</span>
        </Button>


        {hasTeams && (
          <Link to="/teams">
            <Button
              variant="outline"
              className="rounded-xl h-auto py-3 justify-start w-full"
            >
              <Users className="h-4 w-4 mr-2 text-primary" />
              <span className="text-xs font-medium">View Teams</span>
            </Button>
          </Link>
        )}

        {hasMembers && (
          <Link to="/members">
            <Button
              variant="outline"
              className="rounded-xl h-auto py-3 justify-start w-full"
            >
              <TrendingUp className="h-4 w-4 mr-2 text-primary" />
              <span className="text-xs font-medium">Members</span>
            </Button>
          </Link>
        )}


        <Link to="/calendar">
          <Button
            variant="outline"
            className="rounded-xl h-auto py-3 justify-start w-full"
          >
            <Clock className="h-4 w-4 mr-2 text-primary" />
            <span className="text-xs font-medium">Calendar</span>
          </Button>
        </Link>
      </div>

      {/* Burndown Chart */}
      <BurndownChart tasks={visibleTasks} />

      {/* Recent Tasks */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Recent Tasks</h2>

          <Link
            to="/tasks"
            className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
          >
            View All <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {visibleTasks.length === 0 ? (
          <EmptyState
            icon={CheckSquare}
            title="No tasks yet"
            description="Create your first task to get started"
            action={
              <Button
                size="sm"
                onClick={() => {
                  setEditTask(null);
                  setShowForm(true);
                }}
              >
                What's on your mind?
              </Button>
            }
            className
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {visibleTasks.slice(0, 6).map((task) => (
              <TaskCard
                key={task._id}
                task={task}
                members={members}
                onClick={(t) => setDetailTask(t)}
                onComplete
                onReopen
              />
            ))}
          </div>
        )}
      </div>

      {/* Detail Dialog */}
      <TaskDetailDialog
        open={!!detailTask}
        onOpenChange={(v) => {
          if (!v) setDetailTask(null);
        }}
        task={detailTask}
        members={members}
        onEdit={(t) => {
          setDetailTask(null);
          setEditTask(t);
          setShowForm(true);
        }}
        onDeleted={() => {
          setDetailTask(null);
          reload();
        }}
      />

      {/* Form Dialog */}
      <TaskFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        task={editTask}
        teams={teams}
        members={members}
        workspaces={workspaces}
        onSaved={reload} // ✅ manual refresh fallback
      />
    </div>
  );
}
