import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Users, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/AuthContext";
import { upsertMembershipAccess } from "@/db/helpers";

const ROLES = ["member", "admin"];

const getAccessList = (member) => {
  if (Array.isArray(member?.membership_access)) return member.membership_access;
  if (Array.isArray(member?.memberships)) return member.memberships;
  if (Array.isArray(member?.access_rights)) return member.access_rights;
  return [];
};

const getAccessWorkspaceId = (access) => access.workspace_id || access.org_id;
const getAccessTeamIds = (access) => access.team_ids || access.team_id || [];

export default function MemberAccessDialog({
  open,
  onOpenChange,
  member,
  teams = [],
  workspaces = [],
}) {
  const { session, user, setUser, setMemberships, memberships } = useAuth();

  const [selectedTeams, setSelectedTeams] = useState([]);
  const [selectedRole, setSelectedRole] = useState("member");
  const [selectedWorkspace, setSelectedWorkspace] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!member || !open) return;

    const firstAccess = getAccessList(member)[0];
    const defaultWorkspace =
      getAccessWorkspaceId(firstAccess || {}) ||
      workspaces?.[0]?._id ||
      "";

    setSelectedWorkspace(defaultWorkspace);
  }, [member, open, workspaces]);

  useEffect(() => {
    if (!member || !selectedWorkspace) return;

    const current = getAccessList(member).find(
      (access) => getAccessWorkspaceId(access) === selectedWorkspace
    );

    if (current) {
      setSelectedRole(current.role || "member");
      setSelectedTeams(getAccessTeamIds(current));
    } else {
      setSelectedRole("member");
      setSelectedTeams([]);
    }
  }, [selectedWorkspace, member]);

  const filteredTeams = useMemo(
    () => teams.filter((team) => team.workspace_id === selectedWorkspace || team.org_id === selectedWorkspace),
    [teams, selectedWorkspace]
  );

  const toggleTeam = (id) => {
    setSelectedTeams((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id]
    );
  };

  const handleSave = async () => {
    if (!selectedWorkspace || !session?.userId || !member?._id) return;

    setSaving(true);

    try {
      const nextEntry = {
        workspace_id: selectedWorkspace,
        role: selectedRole,
        team_ids: selectedTeams ?? [],
      };

      await upsertMembershipAccess(member._id, nextEntry);

      if (member._id === user?._id || member._id === user?.id) {
        setUser?.((prev) => ({
          ...(prev || {}),
          id: member._id,
          _id: member._id,
        }));
        const currentMemberships = Array.isArray(memberships) ? memberships : [];
        const updatedMemberships = currentMemberships.some((entry) => getAccessWorkspaceId(entry) === selectedWorkspace)
          ? currentMemberships.map((entry) =>
              getAccessWorkspaceId(entry) === selectedWorkspace
                ? { ...entry, ...nextEntry }
                : entry
            )
          : [...currentMemberships, nextEntry];

        setMemberships?.(updatedMemberships);
      }

      window.dispatchEvent(new Event("user:updated"));
      onOpenChange(false);
    } catch (err) {
      console.error("Save access rights error:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-center">
            Manage Access
          </DialogTitle>
          <DialogDescription>
            View and update user roles, access rights, and workspace permissions.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="teams" className="flex-1 flex flex-col overflow-hidden">
          <select
            value={selectedWorkspace}
            onChange={(e) => setSelectedWorkspace(e.target.value)}
            className="w-full p-2 rounded-lg text-sm bg-white dark:bg-[hsl(var(--background))] text-[hsl(var(--foreground))] border border-[hsl(var(--border))]"
          >
            <option value="" className="bg-[hsl(var(--background))]">
              Select workspace
            </option>
            {workspaces.map((workspace) => (
              <option
                key={workspace._id}
                value={workspace._id}
                className="bg-[hsl(var(--background))] text-[hsl(var(--foreground))]"
              >
                {workspace.name}
              </option>
            ))}
          </select>

          <div className="my-5 h-px w-full bg-[hsl(var(--border))]" />

          <Label className="block mb-2 text-xs font-medium text-[hsl(var(--muted-foreground))]">
            Team / Role
          </Label>
          <TabsList className="w-full rounded-xl p-1 bg-[hsl(var(--muted))] border border-[hsl(var(--border))]">
            <TabsTrigger
              value="teams"
              className="flex-1 text-xs text-[hsl(var(--muted-foreground))] data-[state=active]:bg-[hsl(var(--background))] data-[state=active]:text-[hsl(var(--foreground))] data-[state=active]:shadow-sm"
            >
              <Users className="h-3.5 w-3.5 mr-1.5" />
              Teams
            </TabsTrigger>

            <TabsTrigger
              value="role"
              className="flex-1 text-xs text-[hsl(var(--muted-foreground))] data-[state=active]:bg-[hsl(var(--background))] data-[state=active]:text-[hsl(var(--foreground))] data-[state=active]:shadow-sm"
            >
              <Shield className="h-3.5 w-3.5 mr-1.5" />
              Role
            </TabsTrigger>
          </TabsList>

          <TabsContent value="teams" className="flex-1 overflow-y-auto mt-3 space-y-2">
            {filteredTeams.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-6">
                No teams in this workspace
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

                <span className="font-medium truncate">{team.name}</span>
              </button>
            ))}
          </TabsContent>

          <TabsContent value="role" className="flex-1 overflow-y-auto mt-3 space-y-2">
            {!selectedWorkspace && (
              <p className="text-xs text-muted-foreground text-center py-6">
                Choose workspace first
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
            disabled={saving || !selectedWorkspace}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Save Access
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
