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
  DialogDescription
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

export default function Workspace() {
  const { user, setUser } = useAuth();

  // ✅ GLOBAL REAL-TIME DATA
  const {
    workspaces,
    teams,
    loading,
    reload,
  } = useAppData();

  const [showForm, setShowForm] = useState(false);
  const [editOrg, setEditOrg] = useState(null);
  const [deleteOrg, setDeleteOrg] = useState(null);

  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("theme");
    return saved ? saved === "dark" : false;
  });

  const [form, setForm] = useState({
    name: "",
    description: "",
  });

  // -------------------------
  // THEME
  // -------------------------
  useEffect(() => {
    const theme = getSavedTheme();
    setDarkMode(applyTheme(theme));
  }, []);

  // -------------------------
  // OPEN MODALS
  // -------------------------
  const openCreate = () => {
    setEditOrg(null);
    setForm({ name: "", description: "" });
    setShowForm(true);
  };

  const openEdit = (org) => {
    setEditOrg(org);
    setForm({
      name: org.name || "",
      description: org.description || "",
    });
    setShowForm(true);
  };

  // -------------------------
  // SAVE (CREATE / UPDATE)
  // -------------------------
  const handleSave = async (e) => {
    e.preventDefault();

    const db = getDB(user?.id);
    if (!db) return;

    try {
      // =========================
      // UPDATE
      // =========================
      if (editOrg?._id) {
        const existing = await db.get(editOrg._id);

        await db.put({
          ...existing,
          name: form.name,
          description: form.description || "",
          updated_at: new Date().toISOString(),
        });
      }

      // =========================
      // CREATE
      // =========================
      else {
        const newOrgId = `org_${crypto.randomUUID()}`;

        const newOrg = {
          _id: newOrgId,
          type: "organization",
          name: form.name,
          description: form.description || "",
          created_at: new Date().toISOString(),
        };

        await db.put(newOrg);

        // 🔥 update user access rights
        const userDoc = await db.get(user.id);

        const updatedUser = {
          ...userDoc,
          access_rights: [
            ...(userDoc.access_rights || []),
            {
              org_id: newOrgId,
              role: "owner",
            },
          ],
        };

        await db.put(updatedUser);

        setUser(updatedUser);
        sessionStorage.setItem("user", JSON.stringify(updatedUser));
      }

      setShowForm(false);

      // ✅ optional manual refresh (fallback)
      reload?.();
    } catch (err) {
      console.error("❌ Save workspace error:", err);
    }
  };

  // -------------------------
  // DELETE
  // -------------------------
  const handleDelete = async () => {
    if (!deleteOrg) return;

    try {
      const db = getDB(user?.id);
      const doc = await db.get(deleteOrg._id);

      await db.remove(doc);

      setDeleteOrg(null);

      // optional fallback
      reload?.();
    } catch (err) {
      console.error("❌ Delete workspace error:", err);
    }
  };


  // -------------------------
  // LOADING
  // -------------------------
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // -------------------------
  // UI
  // -------------------------
  return (
    <div className="max-w-7xl mx-auto space-y-6">

      {/* HEADER */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Workspaces</h1>
          { }
          <p className="text-sm text-muted-foreground">
            {workspaces.length} workspace
          </p>
        </div>

        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Workspace
        </Button>
      </div>

      {/* EMPTY STATE */}
      {workspaces.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No workspaces yet"
          description="Create an workspace to get started"
          action={<Button onClick={openCreate}>Create Workspace</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {workspaces.map((org) => {
            const isPersonal = org?.account_type == "personal";
            const orgTeams = teams.filter(
              (t) => t.org_id === org._id
            );

            return (
              <div
                key={org._id}
                onClick={() => openEdit(org)}
                className="bg-card border rounded-2xl p-5 cursor-pointer hover:shadow-lg relative group"
              >
                {/* DELETE */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteOrg(org);
                  }}
                  className="absolute top-3 right-3 p-1.5 rounded-lg bg-destructive/10 text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>

                {/* CONTENT */}
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">
                      {org.name}
                    </h3>

                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      {isPersonal ? (
                        <User className="h-3 w-3" />
                      ) : (
                        <Users className="h-3 w-3" />
                      )}

                      {isPersonal
                        ? "Personal"
                        : `${orgTeams.length} team${orgTeams.length !== 1 ? "s" : ""}`}
                    </p>

                  </div>
                </div>

                {org.description && (
                  <p className="text-xs text-muted-foreground mt-3">
                    {org.description}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* FORM */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editOrg ? "Edit Workspace" : "New Workspace"}
            </DialogTitle>
            <DialogDescription>
              Create a new workspace or update existing team details.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm({ ...form, name: e.target.value })
                }
                required
              />
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
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

      {/* DELETE */}
      <AlertDialog
        open={!!deleteOrg}
        onOpenChange={() => setDeleteOrg(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete Workspace
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteOrg?.name}"?
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}