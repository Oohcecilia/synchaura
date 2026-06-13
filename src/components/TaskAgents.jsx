import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Loader2, Bot, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const roleColors = {
  analyst: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  reviewer: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  executor: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  monitor: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
  coordinator: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
};

const statusDot = {
  active: "bg-emerald-500",
  inactive: "bg-slate-400",
  suspended: "bg-red-500",
};

const EMPTY_FORM = { name: "", role: "executor", status: "active", notes: "" };

export default function TaskAgents({ task, onAgentCountChange }) {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingAgent, setEditingAgent] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const data = [];
    // const data = await base44.entities.Agent.filter({ task_id: task.id }, "name");
    setAgents(data);
    onAgentCountChange?.(data.length);
    setLoading(false);
  };

  useEffect(() => { load(); }, [task.id]);

  const openAdd = () => { setEditingAgent(null); setForm(EMPTY_FORM); setShowForm(true); };
  const openEdit = (agent) => {
    setEditingAgent(agent);
    setForm({ name: agent.name, role: agent.role, status: agent.status, notes: agent.notes || "" });
    setShowForm(true);
  };
  const cancel = () => { setShowForm(false); setEditingAgent(null); setForm(EMPTY_FORM); };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    // if (editingAgent) {
    //   await base44.entities.Agent.update(editingAgent.id, form);
    // } else {
    //   await base44.entities.Agent.create({ ...form, task_id: task.id });
    // }
    setSaving(false);
    cancel();
    load();
  };

  const handleDelete = async (agent) => {
    // await base44.entities.Agent.delete(agent.id);
    load();
  };

  const toggleStatus = async (agent) => {
    const next = agent.status === "active" ? "inactive" : "active";
    // await base44.entities.Agent.update(agent.id, { status: next });
    load();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
          <Bot className="h-3.5 w-3.5" /> Agents {agents.length > 0 && <span className="text-foreground">({agents.length})</span>}
        </h4>
        {!showForm && (
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={openAdd}>
            <Plus className="h-3 w-3 mr-1" /> Add Agent
          </Button>
        )}
      </div>

      {/* Inline form */}
      {showForm && (
        <div className="bg-muted/40 rounded-xl border border-border p-3 space-y-3">
          <p className="text-xs font-semibold">{editingAgent ? "Edit Agent" : "New Agent"}</p>
          <div>
            <Label className="text-[11px]">Name *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Agent name"
              className="h-8 text-sm mt-0.5"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[11px]">Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger className="h-8 text-xs mt-0.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="analyst">Analyst</SelectItem>
                  <SelectItem value="reviewer">Reviewer</SelectItem>
                  <SelectItem value="executor">Executor</SelectItem>
                  <SelectItem value="monitor">Monitor</SelectItem>
                  <SelectItem value="coordinator">Coordinator</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[11px]">Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger className="h-8 text-xs mt-0.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-[11px]">Notes</Label>
            <Input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Optional notes…"
              className="h-8 text-sm mt-0.5"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={cancel}>
              <X className="h-3 w-3 mr-1" /> Cancel
            </Button>
            <Button size="sm" className="flex-1 h-8 text-xs" onClick={handleSave} disabled={saving || !form.name.trim()}>
              {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
              {editingAgent ? "Update" : "Add"}
            </Button>
          </div>
        </div>
      )}

      {/* Agent list */}
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
          <Loader2 className="h-3 w-3 animate-spin" /> Loading agents…
        </div>
      ) : agents.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">No agents assigned to this task yet.</p>
      ) : (
        <div className="space-y-2">
          {agents.map((agent) => (
            <div key={agent.id} className="flex items-center gap-2 bg-muted/30 rounded-lg px-3 py-2">
              <div className={cn("h-1.5 w-1.5 rounded-full shrink-0", statusDot[agent.status])} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{agent.name}</p>
                {agent.notes && <p className="text-[11px] text-muted-foreground truncate">{agent.notes}</p>}
              </div>
              <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize", roleColors[agent.role] || "bg-muted text-muted-foreground")}>
                {agent.role}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => toggleStatus(agent)}
                  title={agent.status === "active" ? "Deactivate" : "Activate"}
                  className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                >
                  <div className={cn("h-2 w-2 rounded-full", statusDot[agent.status])} />
                </button>
                <button onClick={() => openEdit(agent)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                  <Pencil className="h-3 w-3" />
                </button>
                <button onClick={() => handleDelete(agent)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
