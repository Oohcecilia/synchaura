import { useMemo, useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { fetchedUserData } from "@/db/api";
import { getDB } from "@/db/couch";
import { nanoid } from "nanoid";
import { useSearchParams } from 'react-router-dom';

import {
  Plus,
  Users,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import EmptyState from "../components/EmptyState";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getSavedTheme, applyTheme } from "@/utils/theme";

const COLORS = ["blue", "green", "purple", "orange", "red", "pink", "teal", "yellow"];
const COLOR_MAP = {
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  purple: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  orange: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  red: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  pink: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
  teal: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
  yellow: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
};



export default function Teams() {
  const { user, hasFullAccess } = useAuth();

  const [teams, setTeams] = useState([]);
  const [workspaces, setWorkspaces] = useState([]);
  const [members, setMembers] = useState([]);

  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTeam, setEditTeam] = useState(null);
  const [deleteTeam, setDeleteTeam] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("theme");
    return saved ? saved === "dark" : false;
  });

  const [form, setForm] = useState({
    name: "",
    description: "",
    organization_id: "",
    color: "blue",
    member_ids: [],
  });

  // =========================
  // LOAD DATA
  // =========================
  const loadData = async () => {
    setLoading(true);
    const res = await fetchedUserData(user);

    setTeams(res.teams || []);
    setWorkspaces(res.workspaces || []);

    // remove owners globally
    setMembers((res.members || []));

    setLoading(false);
  };

  useEffect(() => {
    const theme = getSavedTheme();
    setDarkMode(applyTheme(theme));

    loadData();
  }, [user]);


  useEffect(() => {
    // 1. Check if the "create" param exists in the URL
    if (searchParams.get('create') === 'true') {
      setShowForm(true);

      // 2. Clean up the URL (Removes ?create=true) 
      // This prevents the modal from popping up again if they refresh
      searchParams.delete('create');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);


  // =========================
  // ORG MAP
  // =========================
  const orgMap = useMemo(() => {
    return Object.fromEntries(
      (workspaces || []).map((o) => [o._id, o])
    );
  }, [workspaces]);

  // =========================
  // FILTER MEMBERS BY SELECTED ORG
  // =========================
  const filteredMembers = useMemo(() => {
    if (!form.organization_id) return [];

    return members.filter((m) =>
      (m.access_rights || []).some(
        (a) => a.org_id === form.organization_id
      )
    );
  }, [members, form.organization_id]);

  // =========================
  // TEAM MEMBERS
  // =========================
  const getTeamMembers = (teamId) => {
    const ids = Array.isArray(teamId) ? teamId : [teamId];

    return members.filter((m) =>
      (m.access_rights || []).some((a) =>
        (a.team_id || []).some((id) => ids.includes(id))
      )
    ).length;
  };

  // =========================
  // OPEN CREATE / EDIT
  // =========================
  const openCreate = () => {
    setEditTeam(null);
    setForm({
      name: "",
      description: "",
      organization_id: "",
      color: "blue",
      member_ids: [],
    });
    setShowForm(true);
  };

  const openEdit = (team) => {
    setEditTeam(team);
    setForm({
      ...team,
      organization_id: team.organization_id || team.org_id || "",
      member_ids: team.member_ids || [],
    });
    setShowForm(true);
  };

  // =========================
  // SAVE
  // =========================
  const handleSave = async (e) => {
    e.preventDefault();

    // 1. Get PouchDB instance
    const db = getDB(user?.id);
    if (!db) return;

    if (!form.name || !form.organization_id) return;

    try {
      // =========================
      // UPDATE EXISTING TEAM
      // =========================
      if (editTeam?._id) {
        // Fetch fresh to get current _rev
        const existing = await db.get(editTeam._id);

        await db.put({
          ...existing, // contains _id and _rev
          ...form,
          type: "team", // Ensure type is preserved
          updated_at: new Date().toISOString(),
        });
      }
      // =========================
      // CREATE NEW TEAM
      // =========================
      else {
        const newTeam = {
          _id: `team_${nanoid()}`,
          type: "team",
          ...form,
          created_at: new Date().toISOString(),
        };

        await db.put(newTeam);
      }

      setShowForm(false);
      loadData(); // Re-fetches filtered list
    } catch (err) {
      console.error("❌ Save team error:", err);
    }
  };

  // =========================
  // DELETE TEAM
  // =========================
  const handleDelete = async () => {
    if (!deleteTeam?._id) return;

    try {
      const db = getDB(user?.id);

      // Must fetch the document to get the latest _rev before removal
      const docToDelete = await db.get(deleteTeam._id);
      await db.remove(docToDelete);

      setDeleteTeam(null);
      loadData();
    } catch (err) {
      console.error("❌ Delete team error:", err);
    }
  };

  // =========================
  // LOADING
  // =========================
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">

      {/* HEADER */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Teams</h1>
          <p className="text-sm text-muted-foreground">
            {teams.length} teams
          </p>
        </div>

        {hasFullAccess && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            New Team
          </Button>
        )}
      </div>

      {/* TEAMS */}
      {teams.length === 0 ? (

        <EmptyState
          icon={Users}
          title="No teams yet"
          description="Create teams to organize members"
          action={
            hasFullAccess && (
              <Button onClick={openCreate}>Create Team</Button>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {teams.map((team) => {
            const org = orgMap[team.organization_id || team.org_id];
            const teamMembers = getTeamMembers(team._id);

            return (
              <div
                key={team._id}
                onClick={() => openEdit(team)}
                className="border rounded-2xl p-5 cursor-pointer hover:shadow-lg hover:shadow-primary/5 hover:border-primary/20 relative group"
              >
                {/* DELETE */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTeam(team);
                  }}
                  className="
                        absolute top-4 right-4
                        p-1.5 rounded-lg
                        bg-destructive/10
                        text-destructive
                        opacity-70 hover:opacity-100
                        transition
                      "
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>

                {/* HEADER */}
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${COLOR_MAP[team.color]}`}>
                    {team.name?.[0]}
                  </div>

                  <div>
                    <p className="font-semibold">{team.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {org?.name || "No organization"}
                    </p>
                  </div>
                </div>

                {/* MEMBERS */}
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <Users className="h-3 w-3" />
                  {teamMembers || 0} members
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* FORM */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editTeam ? "Edit Team" : "New Team"}
            </DialogTitle>
              <DialogDescription>
                Create a new team or update existing team details.
              </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4">

            {/* NAME */}
            <div>
              <Label>Team Name</Label>
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm({ ...form, name: e.target.value })
                }
              />
            </div>

            {/* DESCRIPTION */}
            <div>
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </div>

            {/* ORGANIZATION */}
            <div>
              <Label>Organization</Label>
              <Select
                value={form.organization_id}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    organization_id: v,
                    member_ids: [],
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select organization" />
                </SelectTrigger>

                <SelectContent>
                  {workspaces.map((org) => (
                    <SelectItem key={org._id} value={org._id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* MEMBERS */}
            {/* {filteredMembers.length > 0 && (
              <div>
                <Label>Members</Label>

                <div className="border rounded-xl p-3 max-h-48 overflow-auto space-y-2">
                  {filteredMembers.map((m) => {
                    const isSelected = form.member_ids?.includes(m._id);

                    return (
                      <label
                        key={m._id}
                        className="flex items-center gap-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            setForm((prev) => {
                              const ids = prev.member_ids || [];

                              return {
                                ...prev,
                                member_ids: isSelected
                                  ? ids.filter((id) => id !== m._id)
                                  : [...ids, m._id],
                              };
                            });
                          }}
                        />
                        {m.full_name}
                      </label>
                    );
                  })}
                </div>
              </div>
            )} */}

            <div>
              <Label>Color</Label>
              <div className="flex gap-2 mt-1">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm({ ...form, color: c })}
                    className={`h-8 w-8 rounded-full border-2 transition-all ${COLOR_MAP[c]?.split(" ")[0] || "bg-blue-100"} ${form.color === c ? "border-primary scale-110" : "border-transparent"}`}
                  />
                ))}
              </div>
            </div>

            {/* ACTIONS */}
            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowForm(false)}
                className="flex-1"
              >
                Cancel
              </Button>

              <Button type="submit" className="flex-1">
                {editTeam ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* DELETE */}
      <AlertDialog open={!!deleteTeam} onOpenChange={() => setDeleteTeam(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Team</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete "{deleteTeam?.name}"?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
