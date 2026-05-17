import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trash2, UsersRound } from "lucide-react";
import { createRecord, hasTaskAccess } from "@/db/helpers";
import { getTasksLogs, getTeam, getUser } from "@/db/api";
import { Play, Square, Clock, Calendar, MapPin, Users, TrendingUp, Edit } from "lucide-react";
import TaskThread from "@/components/TaskThread";
import { AttachmentsViewer } from "@/components/TaskAttachments";
import { format, formatDistanceToNow } from "date-fns";
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
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}

export default function TaskDetailDialog({ open, onOpenChange, task, members, onEdit }) {
    const { user, session } = useAuth();
    const [timeLogs, setTimeLogs] = useState([]);
    const [running, setRunning] = useState(false);
    const [elapsed, setElapsed] = useState(0);
    const [activeLogId, setActiveLogId] = useState(null);
    const [activeStart, setActiveStart] = useState(null);
    const intervalRef = useRef(null);
    const [deleteTask, setDeleteTask] = useState(null);
    const [team, setTeam] = useState([]);


    const loadLogs = async () => {
        if (!task?._id) return [];

        if (task?.team_id) {
            const fetchTeam = await getTeam(task.team_id);
            setTeam(fetchTeam?.team || null);
        }

        const res = await getTasksLogs(session.userId, task._id);
        const logs = res?.allLogs || [];


        const enrichedLogs = await Promise.all(
            logs.map(async (log) => {
                const logUser = await getUser(log.started_by || log.updated_by);
                return {
                    ...log,
                    user: logUser,
                };
            })
        );

        setTimeLogs(enrichedLogs);

        return enrichedLogs; // ✅ IMPORTANT FIX
    };



    useEffect(() => {
        if (open && task?._id) loadLogs();
        if (!open) stopTimer(false);
    }, [open, task?._id]);

    useEffect(() => {
        if (running) {
            intervalRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
        } else {
            clearInterval(intervalRef.current);
        }
        return () => clearInterval(intervalRef.current);
    }, [running]);



    const startTimer = () => {
        const now = new Date().toISOString();

        setActiveStart(now);
        setElapsed(0);
        setRunning(true);

        // ✅ Add a temporary optimistic log to state so the UI shows "Running..."
        // We use a fake ID so we can easily remove it if the timer is cancelled.
        const tempLog = {
            _id: `temp-${Date.now()}`,
            task_id: task._id,
            started_at: now,
            ended_at: null,
            duration_minutes: null, // null duration triggers your "Running..." UI
            user: session.userId
        };

        setTimeLogs((prev) => [tempLog, ...prev]);
    };

    const stopTimer = async (save = true) => {
        setRunning(false);
        clearInterval(intervalRef.current);

        // If cancelled or there was no active start, clear the temp log and exit
        if (!save || !activeStart) {
            setActiveStart(null);
            setElapsed(0);
            // PouchDB IDs usually don't have 'temp-' unless you specifically named them so locally
            setTimeLogs(prev => prev.filter(l => !l._id?.startsWith('temp-')));
            return;
        }

        const db = getDB(session.userId); // Using your specified DB getter
        const now = new Date().toISOString();

        const duration_seconds = elapsed;
        const duration_minutes = parseFloat((elapsed / 60).toFixed(2));

        try {
            // ✅ 1. Create the complete log record
            const logToSave = {
                task_id: task._id,
                started_by: session.userId,
                started_at: activeStart,
                ended_at: now,
                duration_seconds,
                duration_minutes,
            };

            // This uses the createRecord function we updated earlier for PouchDB
            await createRecord(session.userId, "timelogs", logToSave);

            // ✅ 2. Reload clean + sorted list
            const updatedLogs = await loadLogs();

            // ✅ 3. Calculate total hours
            const totalSeconds = updatedLogs.reduce(
                (sum, l) => sum + (l.duration_seconds || 0),
                0
            );

            // ✅ 4. Update Task with Mandatory _rev handling
            // We fetch the latest version of the task to ensure we have the correct _rev
            const existingTask = await db.get(task._id);

            await db.put({
                ...existingTask, // This brings in the current _rev
                actual_hours: parseFloat((totalSeconds / 3600).toFixed(2)),
                updated_at: now,
            });

        } catch (err) {
            console.error("PouchDB Stop Timer Error:", err);
        } finally {
            // ✅ 5. Reset local states
            setActiveStart(null);
            setElapsed(0);
        }
    };

    // -----------------------------
    // DELETE
    // -----------------------------
    const handleDelete = async () => {
        if (!deleteTask?._id) return;

        try {
            // 1. Get the PouchDB instance
            const db = getDB(session?.userId);
            if (!db) return;

            // 2. Fetch the fresh document to get the current _rev
            // This prevents "409 Conflict" errors during deletion
            const docToRemove = await db.get(deleteTask._id);

            // 3. Remove from local PouchDB (Sync will handle the rest)
            await db.remove(docToRemove);

            // ✅ Reset delete dialog state
            setDeleteTask(null);

            // ✅ Close the Detail Dialog
            onOpenChange(false);

        } catch (err) {
            console.error("❌ Task deletion failed:", err);
        }
    };

    if (!task) return null;

    const allowed = hasTaskAccess(session, task)
    
    const assignedMembers = (task.assigned_to || []).map((id) => members?.find((m) => m.id === id)).filter(Boolean);
    const totalLoggedMins = timeLogs.reduce((sum, l) => sum + (l.duration_minutes || 0), 0);
    const totalLoggedHours = (totalLoggedMins / 60).toFixed(2);
    const efficiency = task.estimated_hours && totalLoggedHours > 0
        ? Math.round((task.estimated_hours / parseFloat(totalLoggedHours)) * 100)
        : null;

    return (
        <>
            <Dialog open={open} onOpenChange={(v) => { if (!v) stopTimer(false); onOpenChange(v); }}>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <div className="flex items-start justify-between gap-2 me-2">
                            <DialogTitle className="text-base leading-snug pr-2">{task.title}</DialogTitle>
                            {allowed &&
                                (
                                    <div className="flex gap-2">
                                        <Button size="sm" variant="outline" onClick={() => { onOpenChange(false); onEdit?.(task); }}>
                                            <Edit className="h-3.5 w-3.5 mr-1" /> Edit
                                        </Button>
                                        <button
                                            autoFocus={false}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setDeleteTask(task);
                                            }}
                                            className="
                                    p-1.5 rounded-lg
                                    bg-destructive/10
                                    text-destructive
                                    opacity-60 hover:opacity-100
                                    transition
                                "
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                )
                            }

                        </div>
                    </DialogHeader>

                    <div className="space-y-5">
                        {/* Badges */}
                        <div className="flex flex-wrap gap-2">
                            <span className={cn("text-[11px] font-semibold px-2.5 py-1 rounded-full capitalize", priorityConfig[task.priority] || priorityConfig.medium)}>
                                {task.priority}
                            </span>
                            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground capitalize">
                                {task.status}
                            </span>
                            {task.due_date && (
                                <span className="flex items-center gap-1 text-[11px] text-muted-foreground border border-border rounded-full px-2.5 py-1">
                                    <Calendar className="h-3 w-3" /> {format(new Date(task.due_date), "MMM d, yyyy")}
                                </span>
                            )}
                        </div>

                        {/* Description */}
                        {task.description && (
                            <p className="text-sm text-muted-foreground">{task.description}</p>
                        )}

                        {/* Location & Members */}
                        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                            {team && (
                                <span className="flex items-center gap-1"><UsersRound className="h-3.5 w-3.5" />{team?.name}</span>
                            )}
                            {task.location_name && (
                                <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{task.location_name}</span>
                            )}
                            {assignedMembers.length > 0 && (
                                <span className="flex items-center gap-1">
                                    <Users className="h-3.5 w-3.5" />
                                    {assignedMembers.map((m) => m.full_name || m.email).join(", ")}
                                </span>
                            )}
                        </div>

                        {/* Hours tracking */}
                        <div className="bg-muted/50 rounded-xl p-4 space-y-3">
                            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                                <TrendingUp className="h-3.5 w-3.5" /> Time Tracking
                            </h4>
                            <div className="grid grid-cols-3 gap-3">
                                <div className="text-center">
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Estimated</p>
                                    <p className="text-lg font-bold mt-0.5">{task.estimated_hours ?? "—"}<span className="text-xs font-normal text-muted-foreground ml-0.5">h</span></p>
                                </div>
                                <div className="text-center">
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Logged</p>
                                    <p className={cn("text-lg font-bold mt-0.5", task.estimated_hours && parseFloat(totalLoggedHours) > task.estimated_hours ? "text-destructive" : "")}>
                                        {totalLoggedHours}<span className="text-xs font-normal text-muted-foreground ml-0.5">h</span>
                                    </p>
                                </div>
                                <div className="text-center">
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Efficiency</p>
                                    <p className={cn("text-lg font-bold mt-0.5", efficiency ? (efficiency >= 100 ? "text-emerald-600" : efficiency >= 75 ? "text-amber-600" : "text-destructive") : "")}>
                                        {efficiency ? `${efficiency}%` : "—"}
                                    </p>
                                </div>
                            </div>

                            {/* Timer */}
                            <div className="flex items-center gap-3 pt-1">
                                {running ? (
                                    <>
                                        <div className="flex-1 font-mono text-sm font-semibold text-primary">{formatDuration(elapsed)}</div>
                                        <Button size="sm" variant="destructive" onClick={() => stopTimer(true)}>
                                            <Square className="h-3.5 w-3.5 mr-1 fill-current" /> Stop & Save
                                        </Button>
                                    </>
                                ) : (
                                    <Button size="sm" onClick={startTimer} className="w-full">
                                        <Play className="h-3.5 w-3.5 mr-1 fill-current" /> Start Timer
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Time Logs */}
                        {timeLogs.length > 0 && (
                            <div className="space-y-2">
                                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                                    <Clock className="h-3.5 w-3.5" /> Log History
                                </h4>
                                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                                    {timeLogs.map((log) => (
                                        <div
                                            key={log._id}
                                            className="flex items-center justify-between text-xs bg-muted/40 rounded-lg px-3 py-2"
                                        >
                                            <span className="text-muted-foreground">
                                                {format(new Date(log.started_at), "MMM d, HH:mm")} {" "}
                                                {log.user?.first_name && (
                                                    <span className="font-medium">
                                                        - {log.user?.first_name}
                                                    </span>
                                                )}

                                            </span>

                                            <span className="font-semibold">
                                                {log.duration_minutes != null
                                                    ? `${log.duration_minutes}m`
                                                    : <span className="text-primary animate-pulse">Running...</span>}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}



                        {/* Attachments */}
                        <AttachmentsViewer attachments={task.attachments} />

                        {/* Discussion Thread */}
                        <TaskThread task={task} members={members} currentUser={session} />
                    </div>

                </DialogContent>
            </Dialog>

            <AlertDialog open={!!deleteTask} onOpenChange={() => setDeleteTask(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Task</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete "{deleteTask?.title}"?
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}