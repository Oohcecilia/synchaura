import { useState, useMemo, useEffect } from "react";
import { useAppData } from "@/lib/DataProvider";
import { useAuth } from "@/lib/AuthContext";

import {
  Plus,
  CheckSquare,
  Search,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

import TaskCard from "../components/TaskCard";
import TaskFormDialog from "../components/TaskFormDialog";
import TaskDetailDialog from "../components/TaskDetailDialog";
import EmptyState from "../components/EmptyState";

import { getSavedTheme, applyTheme } from "@/utils/theme";
import { hasTaskAccess } from "@/db/helpers";

export default function Tasks() {
  const { hasFullAccess } = useAuth();

  // ✅ GLOBAL REAL-TIME DATA
  const {
    tasks,
    teams,
    members,
    workspaces,
    loading,
    reload, // optional manual refresh
  } = useAppData();


  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [tab, setTab] = useState("all");
  const [detailTask, setDetailTask] = useState(null);

  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("theme");
    return saved ? saved === "dark" : false;
  });

  // -----------------------------
  // THEME
  // -----------------------------
  useEffect(() => {
    const theme = getSavedTheme();
    setDarkMode(applyTheme(theme));
  }, []);

  // -----------------------------
  // FILTERED TASKS
  // -----------------------------
  const filtered = useMemo(() => {
    return (tasks ?? []).filter((t) => {
      const matchesSearch =
        !search ||
        t.title?.toLowerCase().includes(search.toLowerCase());

      const matchesTab =
        tab === "all" || t.status === tab;

      return matchesSearch && matchesTab;
    });
  }, [tasks, search, tab]);

  // -----------------------------
  // LOADING
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
    <div className="max-w-7xl mx-auto space-y-6">

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Tasks
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tasks.length} total tasks
          </p>
        </div>

        <Button
          onClick={() => {
            setEditTask(null);
            setShowForm(true);
          }}
          className="rounded-xl shadow-lg shadow-primary/25"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Task
        </Button>
      </div>

      {/* SEARCH */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />

        <Input
          placeholder="Search tasks..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 rounded-xl"
        />
      </div>

      {/* TABS */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-muted/50 rounded-xl p-1">
          <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
          <TabsTrigger value="today" className="text-xs">Today</TabsTrigger>
          <TabsTrigger value="upcoming" className="text-xs">Upcoming</TabsTrigger>
          <TabsTrigger value="reccuring" className="text-xs">Recurring</TabsTrigger>
          <TabsTrigger value="previous" className="text-xs">Previous</TabsTrigger>
          <TabsTrigger value="completed" className="text-xs">Completed</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* CONTENT */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title={search ? "No matching tasks" : "No tasks yet"}
          description={
            search
              ? "Try a different search"
              : "Create your first task to get started"
          }
          action={
            !search && (
              <Button
                size="sm"
                onClick={() => {
                  setEditTask(null);
                  setShowForm(true);
                }}
              >
                Create Task
              </Button>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((task) => (
            <TaskCard
              key={task._id}
              task={task}
              members={members}
              onClick={(t) => setDetailTask(t)}
            />
          ))}
        </div>
      )}

      {/* DETAIL */}
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
      />

      {/* FORM */}
      <TaskFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        task={editTask}
        teams={teams}
        members={members}
        workspaces={workspaces}
        onSaved={reload} // ✅ IMPORTANT FIX
      />
    </div>
  );
}