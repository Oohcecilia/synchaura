import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trash2, UsersRound } from "lucide-react";
import { createRecord, hasTaskAccess } from "@/db/helpers";
import { getTasksLogs, getTeam, getUser } from "@/db/api";
import { Play, Square, Clock, Calendar, MapPin, Users, TrendingUp, Edit } from "lucide-react";
import TaskThread from "@/components/TaskThread";
import { AttachmentsViewer } from "@/components/TaskAttachments";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/AuthContext";
import { getDB } from "@/db/couch";

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";


const priorityConfig = {
    high: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    low: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
};

function formatDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
}

export default function TaskDetailDialog({ open, onOpenChange, task, members = [], onEdit }) {
    const { user } = useAuth();
    const [logs, setLogs] = useState([]);
    const [team, setTeam] = useState(null);
    const [assignee, setAssignee] = useState(null);
    const [running, setRunning] = useState(false);
    const [elapsed, setElapsed] = useState(0);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const intervalRef = useRef(null);

    useEffect(() => {
        if (!task || !user?.id) return;

        async function load() {
            const logsRes = await getTasksLogs(user.id, task._id);
            setLogs(logsRes.allLogs || []);

            if (task.team_id) {
                const teamRes = await getTeam(task.team_id, user.id);
                setTeam(teamRes.team);
            }

            if (task.assigned_to?.[0]) {
                const member = members.find((m) => m._id === task.assigned_to[0]);
                if (member) setAssignee(member);
                else setAssignee(await getUser(task.assigned_to[0]));
            }
        }

        load();
    }, [task, user?.id, members]);

    useEffect(() => {
        if (!running) return;

        intervalRef.current = setInterval(() => {
            setElapsed((prev) => prev + 1);
        }, 1000);

        return () => clearInterval(intervalRef.current);
    }, [running]);

    if (!task) return null;

    const handleStart = async () => {
        const access = await hasTaskAccess(user, task);
        if (!access) return;

        await createRecord("timelog", {
            task_id: task._id,
            user_id: user.id,
            started_at: new Date().toISOString(),
            seconds: 0,
        }, user.id);

        setElapsed(0);
        setRunning(true);
    };

    const handleStop = async () => {
        setRunning(false);
        const db = getDB(user.id);
        const openLog = logs.find((l) => !l.ended_at);
        if (!openLog) return;

        const fresh = await db.get(openLog._id);
        await db.put({
            ...fresh,
            ended_at: new Date().toISOString(),
            seconds: elapsed,
        });
    };

    const handleDelete = async () => {
        if (!task?._id || !user?.id) return;

        try {
            const db = getDB(user.id);
            const fresh = await db.get(task._id);
            await db.remove(fresh);
            setDeleteOpen(false);
            onOpenChange(false);
        } catch (err) {
            console.error("Delete task failed:", err);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center justify-between gap-2">
                        <span>{task.title}</span>
                        <div className="flex items-center gap-2">
                            <Button variant="ghost" size="icon" onClick={() => onEdit?.(task)}>
                                <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setDeleteOpen(true)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                        </div>
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {task.description && <p className="text-sm text-muted-foreground">{task.description}</p>}

                    <div className="flex flex-wrap gap-2">
                        <span className={cn("text-xs px-2 py-1 rounded-full", priorityConfig[task.priority] || priorityConfig.medium)}>
                            {task.priority}
                        </span>
                        <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">{task.status}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                        {task.due_date && (
                            <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                {format(new Date(task.due_date), "MMM d, yyyy h:mm a")}
                            </div>
                        )}
                        {team && (
                            <div className="flex items-center gap-2">
                                <UsersRound className="h-4 w-4 text-muted-foreground" />
                                {team.name}
                            </div>
                        )}
                        {assignee && (
                            <div className="flex items-center gap-2">
                                <Users className="h-4 w-4 text-muted-foreground" />
                                {assignee.first_name || assignee.phone}
                            </div>
                        )}
                        {task.location_name && (
                            <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-muted-foreground" />
                                {task.location_name}
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-3">
                        {!running ? (
                            <Button onClick={handleStart} size="sm">
                                <Play className="h-4 w-4 mr-1" /> Start
                            </Button>
                        ) : (
                            <Button onClick={handleStop} size="sm" variant="destructive">
                                <Square className="h-4 w-4 mr-1" /> Stop
                            </Button>
                        )}

                        <span className="text-sm text-muted-foreground flex items-center gap-1">
                            <Clock className="h-4 w-4" /> {formatDuration(elapsed)}
                        </span>
                    </div>

                    <div>
                        <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
                            <TrendingUp className="h-4 w-4" /> Time logs
                        </h4>
                        {logs.length === 0 ? (
                            <p className="text-xs text-muted-foreground">No logs yet</p>
                        ) : (
                            <div className="space-y-1">
                                {logs.map((log) => (
                                    <div key={log._id} className="text-xs text-muted-foreground flex justify-between border rounded-lg p-2">
                                        <span>{log.started_at ? format(new Date(log.started_at), "MMM d, h:mm a") : "Log"}</span>
                                        <span>{formatDuration(log.seconds || 0)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <AttachmentsViewer task={task} />
                    <TaskThread task={task} members={members} />
                </div>

                <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete Task</AlertDialogTitle>
                            <AlertDialogDescription>
                                Are you sure you want to delete "{task.title}"? This cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </DialogContent>
        </Dialog>
    );
}
