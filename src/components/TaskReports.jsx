import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Loader2, FileText, X, Check, Pencil, Trash2, Search, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const statusConfig = {
  draft:        { label: "Draft",        cls: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
  submitted:    { label: "Submitted",    cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  under_review: { label: "Under Review", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  approved:     { label: "Approved",     cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  rejected:     { label: "Rejected",     cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
};

const EMPTY_FORM = { title: "", description: "", status: "draft", notes: "", agent_id: "" };

export default function TaskReports({ task, agents }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingReport, setEditingReport] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [expandedId, setExpandedId] = useState(null);

  const load = async () => {
    setLoading(true);
    const data = [];
    // const data = await base44.entities.AgentReport.filter({ task_id: task.id }, "-created_date");
    setReports(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, [task.id]);

  const openAdd = () => { setEditingReport(null); setForm(EMPTY_FORM); setShowForm(true); };
  const openEdit = (r) => {
    setEditingReport(r);
    setForm({ title: r.title, description: r.description || "", status: r.status, notes: r.notes || "", agent_id: r.agent_id });
    setShowForm(true);
  };
  const cancel = () => { setShowForm(false); setEditingReport(null); setForm(EMPTY_FORM); };

  const handleSave = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    // const payload = {
    //   ...form,
    //   task_id: task.id,
    //   submission_date: form.status === "submitted" ? new Date().toISOString() : (editingReport?.submission_date || null),
    // };
    // if (editingReport) {
    //   await base44.entities.AgentReport.update(editingReport.id, payload);
    // } else {
    //   await base44.entities.AgentReport.create(payload);
    // }
    setSaving(false);
    cancel();
    load();
  };

  const handleDelete = async (r) => {
    // await base44.entities.AgentReport.delete(r.id);
    load();
  };

  const updateStatus = async (r, newStatus) => {
    // await base44.entities.AgentReport.update(r.id, {
    //   status: newStatus,
    //   submission_date: newStatus === "submitted" ? new Date().toISOString() : r.submission_date,
    // });
    load();
  };

  const filtered = reports.filter((r) => {
    const matchSearch = !search || r.title?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || r.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const agentName = (id) => agents?.find((a) => a.id === id)?.name || "Unknown Agent";

  // Progress bar
  const total = reports.length;
  const approved = reports.filter((r) => r.status === "approved").length;
  const progress = total > 0 ? Math.round((approved / total) * 100) : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5" /> Reports {total > 0 && <span className="text-foreground">({total})</span>}
        </h4>
        {!showForm && (
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={openAdd}>
            <Plus className="h-3 w-3 mr-1" /> Add Report
          </Button>
        )}
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{approved} of {total} approved</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {/* Inline form */}
      {showForm && (
        <div className="bg-muted/40 rounded-xl border border-border p-3 space-y-3">
          <p className="text-xs font-semibold">{editingReport ? "Edit Report" : "New Report"}</p>
          <div>
            <Label className="text-[11px]">Title *</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Report title…" className="h-8 text-sm mt-0.5" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[11px]">Agent</Label>
              <Select value={form.agent_id} onValueChange={(v) => setForm({ ...form, agent_id: v })}>
                <SelectTrigger className="h-8 text-xs mt-0.5"><SelectValue placeholder="Select agent…" /></SelectTrigger>
                <SelectContent>
                  {(agents || []).map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[11px]">Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger className="h-8 text-xs mt-0.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(statusConfig).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-[11px]">Description</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Summary…" rows={2} className="text-sm mt-0.5" />
          </div>
          <div>
            <Label className="text-[11px]">Supporting Notes</Label>
            <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Additional notes…" className="h-8 text-sm mt-0.5" />
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={cancel}><X className="h-3 w-3 mr-1" /> Cancel</Button>
            <Button size="sm" className="flex-1 h-8 text-xs" onClick={handleSave} disabled={saving || !form.title.trim()}>
              {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
              {editingReport ? "Update" : "Submit"}
            </Button>
          </div>
        </div>
      )}

      {/* Search + filter */}
      {reports.length > 0 && (
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search reports…" className="h-7 pl-7 text-xs" />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="h-7 text-xs w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {Object.entries(statusConfig).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Report list */}
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
          <Loader2 className="h-3 w-3 animate-spin" /> Loading reports…
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">
          {reports.length === 0 ? "No reports yet. Add one above." : "No reports match your filter."}
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => {
            const sc = statusConfig[r.status] || statusConfig.draft;
            const isExpanded = expandedId === r.id;
            return (
              <div key={r.id} className="bg-muted/30 rounded-lg border border-border overflow-hidden">
                <div
                  className="flex items-center gap-2 px-3 py-2 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : r.id)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{r.title}</p>
                    <p className="text-[11px] text-muted-foreground">{agentName(r.agent_id)}</p>
                  </div>
                  <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap", sc.cls)}>{sc.label}</span>
                  {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                </div>

                {isExpanded && (
                  <div className="px-3 pb-3 border-t border-border space-y-2 pt-2">
                    {r.description && <p className="text-xs text-muted-foreground">{r.description}</p>}
                    {r.notes && <p className="text-[11px] text-muted-foreground italic">{r.notes}</p>}
                    {r.submission_date && (
                      <p className="text-[11px] text-muted-foreground">
                        Submitted: {format(new Date(r.submission_date), "MMM d, yyyy HH:mm")}
                      </p>
                    )}
                    {/* Quick status change */}
                    <div className="flex flex-wrap gap-1 pt-1">
                      {Object.entries(statusConfig).filter(([k]) => k !== r.status).map(([k, v]) => (
                        <button
                          key={k}
                          onClick={() => updateStatus(r, k)}
                          className={cn("text-[10px] px-2 py-0.5 rounded-full border border-border hover:opacity-80 transition-opacity", v.cls)}
                        >
                          → {v.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={() => openEdit(r)}>
                        <Pencil className="h-3 w-3 mr-1" /> Edit
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => handleDelete(r)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}