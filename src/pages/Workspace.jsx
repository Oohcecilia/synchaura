import { useState, useEffect } from "react";
import { useAppData } from "@/lib/DataProvider";
import { useAuth } from "@/lib/AuthContext";

import {
  Plus,
  Building2,
  User,
  Users,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import EmptyState from "../components/EmptyState";

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

import { getDB } from "@/db/couch";
import { getSavedTheme, applyTheme } from "@/utils/theme";
import { nanoid } from "nanoid";

export default function Workspace() {
  const { session, memberships, setMemberships } = useAuth();
  const { workspaces, teams, loading, reload } = useAppData();


  const [showForm, setShowForm] = useState(false);
  const [editOrg, setEditOrg] = useState(null);
  const [deleteOrg, setDeleteOrg] = useState(null);
  const [form, setForm] = useState({ name: "", description: "" });

  useEffect(() => {
    const theme = getSavedTheme();
    applyTheme(theme);
  }, []);

  const openCreate = () => {
    setEditOrg(null);
    setForm({ name: "", description: "" });
    setShowForm(true);
  };

  const openEdit = (workspace) => {
    setEditOrg(workspace);
    setForm({
      name: workspace.name || "",
      description: workspace.description || "",
    });
    setShowForm(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();

    if (!session?.userId) return;

    const db = getDB(session.userId);

    try {
      if (editOrg?._id) {
        const existing = await db.get(editOrg._id);

        await db.put({
          ...existing,
          name: form.name,
          description: form.description || "",
          updated_at: new Date().toISOString(),
        });
      } else {
        const now = new Date().toISOString();
        const workspaceId = `ws_${nanoid()}`;
        const membershipId = `mem_${nanoid()}`;

        const newWorkspace = {
          _id: workspaceId,
          type: "workspace",
          account_type: "team",
          name: form.name,
          description: form.description || "",
          owner_id: session.userId,
          created_at: now,
        };

        const membership = {
          _id: membershipId,
          type: "membership",
          user_id: session.userId,
          workspace_id: workspaceId,
          role: "owner",
          team_ids: [],
          created_at: now,
        };

        await db.bulkDocs([newWorkspace, membership]);

        const existingAccess = memberships || [];
        const nextAccess = [
          ...existingAccess,
          {
            workspace_id: workspaceId,
            role: "owner",
            team_ids: [],
          },
        ];

        setMemberships?.(nextAccess);
      }

      setShowForm(false);
      reload?.();
    } catch (err) {
      console.error("Save workspace error:", err);
    }
  };

  const handleDelete = async () => {
    if (!deleteOrg || !session?.userId) return;

    try {
      const db = getDB(session.userId);
      const doc = await db.get(deleteOrg._id);

      await db.remove(doc);
      setDeleteOrg(null);
      reload?.();
    } catch (err) {
      console.error("Delete workspace error:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Workspaces</h1>
          <p className="text-sm text-muted-foreground">
            {workspaces.length} workspace{workspaces.length !== 1 ? "s" : ""}
          </p>
        </div>

        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Workspace
        </Button>
      </div>

      {workspaces.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No workspaces yet"
          description="Create a workspace to get started"
          action={<Button onClick={openCreate}>Create Workspace</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {workspaces.map((workspace) => {
            const isPersonal = workspace?.account_type === "personal";
            const workspaceTeams = teams.filter(
              (team) => team.workspace_id === workspace._id || team.org_id === workspace._id
            );

            return (
              <div
                key={workspace._id}
                onClick={() => openEdit(workspace)}
                className="bg-card border rounded-2xl p-5 cursor-pointer hover:shadow-lg relative group"
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteOrg(workspace);
                  }}
                  className="absolute top-3 right-3 p-1.5 rounded-lg bg-destructive/10 text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>

                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">{workspace.name}</h3>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      {isPersonal ? <User className="h-3 w-3" /> : <Users className="h-3 w-3" />}
                      {isPersonal
                        ? "Personal"
                        : `${workspaceTeams.length} team${workspaceTeams.length !== 1 ? "s" : ""}`}
                    </p>
                  </div>
                </div>

                {workspace.description && (
                  <p className="text-xs text-muted-foreground mt-3">
                    {workspace.description}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editOrg ? "Edit Workspace" : "New Workspace"}</DialogTitle>
            <DialogDescription>
              Create a new workspace or update existing workspace details.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowForm(false)}
                className="flex-1"
              >
                Cancel
              </Button>

              <Button type="submit" className="flex-1">
                {editOrg ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteOrg} onOpenChange={() => setDeleteOrg(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Workspace</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteOrg?.name}"?
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
