import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Users, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { getDB } from "@/db/couch";


const ROLES = ["member"];

import { useAuth } from "@/lib/AuthContext";

export default function MemberAccessDialog({
  open,
  onOpenChange,
  member,
  teams = [],
  workspace = [],
}) {
  const { user, setUser } = useAuth();

  const [selectedTeams, setSelectedTeams] = useState([]);
  const [selectedRole, setSelectedRole] = useState("member");
  const [selectedOrg, setSelectedOrg] = useState("");
  const [saving, setSaving] = useState(false);

  // =========================
  // INIT ORG
  // =========================
  useEffect(() => {
    if (!member || !open) return;

    const defaultOrg =
      member.access_rights?.[0]?.org_id ||
      workspace?.[0]?._id ||
      "";

    setSelectedOrg(defaultOrg);
  }, [member, open, workspace]);

  // =========================
  // SYNC ROLE + TEAMS WHEN ORG CHANGES
  // =========================
  useEffect(() => {
    if (!member || !selectedOrg) return;

    const current = member.access_rights?.find(
      (a) => a.org_id === selectedOrg
    );

    if (current) {
      setSelectedRole(current.role || "member");
      setSelectedTeams(current.team_id || []);
    } else {
      setSelectedRole("member");
      setSelectedTeams([]);
    }
  }, [selectedOrg, member]);

  // =========================
  // FILTER TEAMS
  // =========================
  const filteredTeams = teams.filter(
    (t) => t.org_id === selectedOrg
  );

  // =========================
  // TOGGLE TEAM
  // =========================
  const toggleTeam = (id) => {
    setSelectedTeams((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id]
    );
  };

  // =========================
  // SAVE
  // =========================
const handleSave = async () => {
    if (!selectedOrg) return;

    setSaving(true);

    try {
      // 1. Get the PouchDB instance
      const db = getDB(user?.id);
      if (!db) return;

      // 2. Fetch the member doc from PouchDB to get latest _rev
      const dbUser = await db.get(member._id);
      if (!dbUser) throw new Error("User document not found in local DB");

      // 3. Logic to update or add access rights
      const access = Array.isArray(dbUser.access_rights)
        ? dbUser.access_rights
        : [];

      const exists = access.some(a => a.org_id === selectedOrg);

      const updatedAccess = exists
        ? access.map(a =>
          a.org_id === selectedOrg
            ? {
              ...a,
              role: selectedRole,
              team_id: selectedTeams ?? [],
            }
            : a
        )
        : [
          ...access,
          {
            org_id: selectedOrg,
            role: selectedRole,
            team_id: selectedTeams ?? [],
          },
        ];

      // 4. Construct the updated document
      const updatedUserDoc = {
        ...dbUser, // Preserves _id, _rev, and other fields like phone/email
        access_rights: updatedAccess,
        updated_at: new Date().toISOString(),
      };

      // 5. Save to PouchDB
      await db.put(updatedUserDoc);

      // 6. Update local state if the user edited themselves
      // if (member._id === user?._id) {
      //   setUser?.(updatedUserDoc);
      //   // Sync with session so page refreshes don't lose the new role
      //   sessionStorage.setItem("user", JSON.stringify(updatedUserDoc));
      // }

      // 7. Notify components to refresh UI
      window.dispatchEvent(new Event("user:updated"));
      onOpenChange(false);

    } catch (err) {
      console.error("❌ Save access rights error:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col">

        <DialogHeader>
          <DialogTitle className="text-center">
            Manage Access — {member.first_name || member.email}
          </DialogTitle>
            <DialogDescription>
              View and update user roles, access rights, and organization permissions.
            </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="teams" className="flex-1 flex flex-col overflow-hidden">
          {/* ORGANIZATION SELECT */}
          <select
            value={selectedOrg}
            onChange={(e) => setSelectedOrg(e.target.value)}
            className="
                      w-full p-2 rounded-lg text-sm 
                      bg-white dark:bg-[hsl(var(--background))] 
                      text-[hsl(var(--foreground))]
                      border border-[hsl(var(--border))]
                    "
          >
            <option value="" className="bg-[hsl(var(--background))]">
              Select organization
            </option>
            {workspace.map((org) => (
              <option
                key={org._id}
                value={org._id}
                className="bg-[hsl(var(--background))] text-[hsl(var(--foreground))]"
              >
                {org.name}
              </option>
            ))}
          </select>

          <div className="my-5 h-px w-full bg-[hsl(var(--border))]" />

          {/* ================= TABS ================= */}
          <Label
            className="
              block mb-2
              text-xs font-medium
              text-[hsl(var(--muted-foreground))]
            "
          >
            Team / Role
          </Label>
          <TabsList
            className="
                        w-full rounded-xl p-1
                        bg-[hsl(var(--muted))]
                        border border-[hsl(var(--border))]
                      "
          >
            <TabsTrigger
              value="teams"
              className="
                          flex-1 text-xs
                          text-[hsl(var(--muted-foreground))]
                          data-[state=active]:bg-[hsl(var(--background))]
                          data-[state=active]:text-[hsl(var(--foreground))]
                          data-[state=active]:shadow-sm
                        "
            >
              <Users className="h-3.5 w-3.5 mr-1.5" />
              Teams
            </TabsTrigger>

            <TabsTrigger
              value="role"
              className="
                          flex-1 text-xs
                          text-[hsl(var(--muted-foreground))]
                          data-[state=active]:bg-[hsl(var(--background))]
                          data-[state=active]:text-[hsl(var(--foreground))]
                          data-[state=active]:shadow-sm
                        "
            >
              <Shield className="h-3.5 w-3.5 mr-1.5" />
              Role
            </TabsTrigger>
          </TabsList>

          {/* ================= TEAMS ================= */}
          <TabsContent value="teams" className="flex-1 overflow-y-auto mt-3 space-y-2">

            {filteredTeams.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-6">
                No teams in this organization
              </p>
            )}

            {filteredTeams.map((team) => (
              <button
                key={team._id}
                type="button"
                onClick={() => toggleTeam(team._id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-sm",
                  selectedTeams.includes(team._id)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card border-border hover:border-primary/40"
                )}
              >
                <div
                  className={cn(
                    "h-5 w-5 rounded border-2 flex items-center justify-center",
                    selectedTeams.includes(team._id)
                      ? "border-primary-foreground bg-primary-foreground/20"
                      : "border-current opacity-40"
                  )}
                >
                  {selectedTeams.includes(team._id) && (
                    <div className="h-2 w-2 bg-primary-foreground rounded-sm" />
                  )}
                </div>

                <span className="font-medium truncate">
                  {team.name}
                </span>
              </button>
            ))}
          </TabsContent>

          {/* ================= ROLE ================= */}
          <TabsContent value="role" className="flex-1 overflow-y-auto mt-3 space-y-2">

            {!selectedOrg && (
              <p className="text-xs text-muted-foreground text-center py-6">
                Choose organization first
              </p>
            )}

            {ROLES.map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => setSelectedRole(role)}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm capitalize",
                  selectedRole === role
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card border-border hover:border-primary/40"
                )}
              >
                <span className="font-medium">{role}</span>

                {selectedRole === role && (
                  <div className="h-2 w-2 bg-primary-foreground rounded-sm" />
                )}
              </button>
            ))}

          </TabsContent>

        </Tabs>

        {/* ================= FOOTER ================= */}
        <div className="flex gap-2 pt-3 border-t mt-3">

          <Button
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>

          <Button
            className="flex-1"
            onClick={handleSave}
            disabled={saving}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Save Access
          </Button>

        </div>

      </DialogContent>
    </Dialog>
  );
}