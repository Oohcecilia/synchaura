import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Play, Square, Clock, Calendar, MapPin, Users, TrendingUp, Edit, Bot, FileText, MessageSquare } from "lucide-react";
import TaskThread from "@/components/TaskThread";
import TaskAgents from "@/components/TaskAgents";
import TaskReports from "@/components/TaskReports";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/AuthContext";
import { getDB } from "@/db/couch";

const priorityConfig = {
    high: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    low: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
};

// Consolidated helper for runtime clock displays
function formatDuration(totalSeconds) {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return [
        hrs > 0 ? String(hrs).padStart(2, "0") : null,
        String(mins).padStart(2, "0"),
        String(secs).padStart(2, "0")
    ].filter(Boolean).join(":");
}

export default function TaskDetailDialog({ open, onOpenChange, task, members = [], onEdit }) {
    const { user, session } = useAuth();
    const [timeLogs, setTimeLogs] = useState([]);
    const [team, setTeam] = useState(null);
    const [assignee, setAssignee] = useState([]); 
    const [running, setRunning] = useState(false);
    const [elapsed, setElapsed] = useState(0);
    const [activeLogId, setActiveLogId] = useState(null);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [agents, setAgents] = useState([]);
    const [agentCount, setAgentCount] = useState(0);
    
    const intervalRef = useRef(null);

    // ==========================================
    // 1. FUNCTION DECLARATIONS (Moved UP to avoid TDZ)
    // ==========================================

    const loadLogs = async () => {

        if (!task?._id || !session?.userId) return;
        const db = getDB(session.userId);
        try {
            const result = await db.allDocs({ include_docs: true });
            const logs = result.rows
                .map((row) => row.doc)
                .filter((doc) => doc.type === "timelog" && doc.task_id === task._id)
                .sort((a, b) => new Date(b.started_at) - new Date(a.started_at));
            setTimeLogs(logs);
        } catch (err) {
            console.error("Failed to load time logs from PouchDB:", err);
        }
    };

    const startTimer = async () => {
        if (!task?._id || !session?.userId) return;
        const db = getDB(session.userId);
        const now = new Date().toISOString();
        
        const newLog = {
            _id: `timelog_${Date.now()}`,
            type: "timelog",
            task_id: task._id,
            started_at: now,
            duration_minutes: null,
        };

        try {
            await db.put(newLog);
            setActiveLogId(newLog._id);
            setElapsed(0);
            setRunning(true);
            await loadLogs();
        } catch (err) {
            console.error("Failed to start timer entry:", err);
        }
    };

    const stopTimer = async (save = true) => {
        setRunning(false);
        if (intervalRef.current) clearInterval(intervalRef.current);

        if (!save || !activeLogId || !session?.userId) {
            setActiveLogId(null);
            setElapsed(0);
            return;
        }

        const db = getDB(session.userId);
        const now = new Date().toISOString();
        const mins = Math.round(elapsed / 60);

        try {
            const freshLog = await db.get(activeLogId);
            await db.put({
                ...freshLog,
                ended_at: now,
                duration_minutes: mins,
            });

            // Recalculate and update parent task's cumulative actual_hours
            const totalMins = timeLogs.reduce((sum, l) => sum + (l._id === activeLogId ? mins : l.duration_minutes || 0), 0);
            try {
                const freshTask = await db.get(task._id);
                await db.put({
                    ...freshTask,
                    actual_hours: parseFloat((totalMins / 60).toFixed(2))
                });
            } catch (taskErr) {
                console.warn("Could not find/update related task document structure in PouchDB:", taskErr);
            }

            setActiveLogId(null);
            setElapsed(0);
            await loadLogs();
        } catch (err) {
            console.error("Failed saving timer duration adjustments:", err);
        }
    };

    const handleDelete = async () => {
        if (!task?._id || !session?.userId) return;

        try {
            const db = getDB(session.userId);
            const fresh = await db.get(task._id);
            await db.remove(fresh);
            setDeleteOpen(false);
            onOpenChange(false);
        } catch (err) {
            console.error("Delete task document failed:", err);
        }
    };


    // ==========================================
    // 2. EFFECTS
    // ==========================================

    // Sync baseline Task Relations & Metadata
    useEffect(() => {
        if (!task || !session?.userId) return;

        async function loadRelations() {
            if (task.team_id) {
                try {
                    const db = getDB(session.userId);
                    const teamRes = await db.get(task.team_id);
                    setTeam(teamRes);
                } catch (e) {
                    console.error("Failed to load team context:", e);
                }
            }

            if (task.assigned_to && task.assigned_to.length > 0) {
                const resolved = task.assigned_to.map((id) => {
                    return members.find((m) => m._id === id || m.id === id) || { _id: id, email: "Assigned Member" };
                });
                setAssignee(resolved);
            } else {
                setAssignee([]);
            }
        }

        loadRelations();
    }, [task, session?.userId, members]);

    // Trigger log fetching when Dialog opens
    useEffect(() => {
        if (open && task?._id) {
            loadLogs();
        }
        if (!open) {
            stopTimer(false);
        }
    }, [open, task?._id]);

    // Timer Interval Handler
    useEffect(() => {
        if (running) {
            intervalRef.current = setInterval(() => {
                setElapsed((prev) => prev + 1);
            }, 1000);
        } else {
            if (intervalRef.current) clearInterval(intervalRef.current);
        }
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [running]);


    // ==========================================
    // 3. RENDER & DERIVED STATE
    // ==========================================

    if (!task) return null;

    // Derived Time Computations
    const totalLoggedMins = timeLogs.reduce((sum, l) => sum + (l.duration_minutes || 0), 0);
    const totalLoggedHours = (totalLoggedMins / 60).toFixed(2);
    const efficiency = task.estimated_hours && parseFloat(totalLoggedHours) > 0
        ? Math.round((task.estimated_hours / parseFloat(totalLoggedHours)) * 100)
        : null;

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) stopTimer(false); onOpenChange(v); }}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <div className="flex items-start justify-between gap-2 mr-4">
                        <DialogTitle className="text-base leading-snug pr-2">{task.title}</DialogTitle>
                        <Button size="sm" variant="outline" onClick={() => { onOpenChange(false); onEdit?.(task); }}>
                            <Edit className="h-3.5 w-3.5 mr-1" /> Edit
                        </Button>
                    </div>
                </DialogHeader>

                {/* Badges */}
                <div className="flex flex-wrap gap-2">
                    <span className={cn("text-[11px] font-semibold px-2.5 py-1 rounded-full capitalize", priorityConfig[task.priority] || priorityConfig.medium)}>
                        {task.priority || "medium"} priority
                    </span>
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground capitalize">
                        {task.status}
                    </span>
                    {task.due_date && (
                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground border border-border rounded-full px-2.5 py-1">
                            <Calendar className="h-3 w-3" /> {format(new Date(task.due_date), "MMM d, yyyy")}
                        </span>
                    )}
                    {agentCount > 0 && (
                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground border border-border rounded-full px-2.5 py-1">
                            <Bot className="h-3 w-3" /> {agentCount} agent{agentCount !== 1 ? "s" : ""}
                        </span>
                    )}
                </div>

                <Tabs defaultValue="overview" className="w-full">
                    <TabsList className="bg-muted/50 rounded-xl p-1 w-full">
                        <TabsTrigger value="overview" className="rounded-lg text-xs flex-1">Overview</TabsTrigger>
                        <TabsTrigger value="agents" className="rounded-lg text-xs flex-1 flex items-center gap-1">
                            <Bot className="h-3 w-3" /> Agents
                        </TabsTrigger>
                        <TabsTrigger value="reports" className="rounded-lg text-xs flex-1 flex items-center gap-1">
                            <FileText className="h-3 w-3" /> Reports
                        </TabsTrigger>
                        <TabsTrigger value="discussion" className="rounded-lg text-xs flex-1 flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" /> Discussion
                        </TabsTrigger>
                    </TabsList>

                    {/* Overview Tab */}
                    <TabsContent value="overview" className="space-y-5 mt-4">
                        {task.description && (
                            <p className="text-sm text-muted-foreground">{task.description}</p>
                        )}
                        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                            {task.location_name && (
                                <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{task.location_name}</span>
                            )}
                            {assignee.length > 0 && (
                                <span className="flex items-center gap-1">
                                    <Users className="h-3.5 w-3.5" />
                                    {assignee.map((m) => m.full_name || m.email).join(", ")}
                                </span>
                            )}
                        </div>

                        {/* Time Tracking */}
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

                        {/* Optional Attachments Section */}
                        {/* <AttachmentsViewer attachments={task.attachments} /> */}

                        {timeLogs.length > 0 && (
                            <div className="space-y-2">
                                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                                    <Clock className="h-3.5 w-3.5" /> Log History
                                </h4>
                                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                                    {timeLogs.map((log) => (
                                        <div key={log._id} className="flex items-center justify-between text-xs bg-muted/40 rounded-lg px-3 py-2">
                                            <span className="text-muted-foreground">
                                                {log.started_at ? format(new Date(log.started_at), "MMM d, HH:mm") : "Unknown"}
                                            </span>
                                            <span className="font-semibold">
                                                {log.duration_minutes != null ? `${log.duration_minutes}m` : <span className="text-primary animate-pulse">Running...</span>}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </TabsContent>

                    {/* Agents Tab */}
                    <TabsContent value="agents" className="mt-4">
                        <TaskAgents
                            task={task}
                            onAgentCountChange={async (count) => {
                                setAgentCount(count);
                                try {
                                    const db = getDB(session?.userId);
                                    const result = await db.allDocs({ include_docs: true });
                                    const filteredAgents = result.rows
                                        .map(r => r.doc)
                                        .filter(d => d.type === "agent" && d.task_id === task._id);
                                    setAgents(filteredAgents);
                                } catch (e) {
                                    console.error(e);
                                }
                            }}
                        />
                    </TabsContent>

                    {/* Reports Tab */}
                    <TabsContent value="reports" className="mt-4">
                        <TaskReports task={task} agents={agents} />
                    </TabsContent>

                    {/* Discussion Tab */}
                    <TabsContent value="discussion" className="mt-4">
                        <TaskThread task={task} members={members} />
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
