import { useState, useMemo, useEffect } from "react";
import { useAppData } from "@/lib/DataProvider";

import {
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

export default function Tasks() {
  const {
    tasks,
    teams,
    members,
    workspaces,
    loading,
    reload,
  } = useAppData();

  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [tab, setTab] = useState("all");
  const [detailTask, setDetailTask] = useState(null);

  useEffect(() => {
    const theme = getSavedTheme();
    applyTheme(theme);
  }, []);

  const filtered = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return (tasks ?? []).filter((t) => {
      const matchesSearch =
        !normalizedSearch ||
        t.title?.toLowerCase().includes(normalizedSearch);

      const matchesTab = tab === "all" || t.status === tab;

      return matchesSearch && matchesTab;
    });
  }, [tasks, search, tab]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
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
          className="rounded-xl shadow-lg shadow-primary/25 text-sm"
        >
          What's on your mind?
        </Button>
      </div>

      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search tasks..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 rounded-xl"
        />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-muted/50 rounded-xl p-1">
          <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
          <TabsTrigger value="today" className="text-xs">Today</TabsTrigger>
          <TabsTrigger value="upcoming" className="text-xs">Upcoming</TabsTrigger>
          <TabsTrigger value="recurring" className="text-xs">Recurring</TabsTrigger>
          <TabsTrigger value="previous" className="text-xs">Previous</TabsTrigger>
          <TabsTrigger value="completed" className="text-xs">Completed</TabsTrigger>
        </TabsList>
      </Tabs>

      {filtered.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title={search ? "No matching tasks" : "No tasks yet"}
          description={
            search
              ? "Try a different search"
              : "Create your first task to get started"
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

      <TaskFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        task={editTask}
        teams={teams}
        members={members}
        workspaces={workspaces}
        onSaved={reload}
      />
    </div>
  );
}
