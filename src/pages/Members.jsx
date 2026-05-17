import { useState, useMemo, useEffect } from "react";
import { UserCircle, Phone, UserPlus, Settings2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import EmptyState from "../components/EmptyState";
import { useAppData } from "@/lib/DataProvider";
import { useAuth } from "@/lib/AuthContext";
import { createNotification } from "@/db/notification";
import { getSavedTheme, applyTheme } from "@/utils/theme";


import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";


import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import MemberAccessDialog from "@/components/MemberAccessDialog";

const ROLE_STYLE = {
  owner: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  admin: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  member: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
};

export default function Members() {
  const { user, session } = useAuth();
  const { members, teams, workspaces, loading, reload } = useAppData();

  const [showInvite, setShowInvite] = useState(false);
  const [accessMember, setAccessMember] = useState(null);
  const [inviteForm, setInviteForm] = useState({
    phone: "",
    workspace_id: "",
    role: "member",
  });

  useEffect(() => {
    const theme = getSavedTheme();
    applyTheme(theme);
  }, []);

  const memberRows = useMemo(() => {
    return (members || []).map((member) => ({
      ...member,
      displayName: member.full_name || `${member.first_name || ""} ${member.last_name || ""}`.trim() || member.phone,
    }));
  }, [members]);

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!session?.userId || !inviteForm.phone || !inviteForm.workspace_id) return;

    const target = members.find((member) => member.phone === inviteForm.phone);
    if (!target) return;

    await createNotification(
      {
        type: "invitation",
        title: "Workspace invitation",
        message: "You have been invited to join a workspace.",
        user_id: target._id,
        workspace_id: inviteForm.workspace_id,
        role: inviteForm.role,
        created_by: session.userId,
      },
      session.userId
    );

    setShowInvite(false);
    setInviteForm({ phone: "", workspace_id: "", role: "member" });
    reload?.();
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Members</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {memberRows.length} member{memberRows.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={() => setShowInvite(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Invite Member
        </Button>
      </div>

      {memberRows.length === 0 ? (
        <EmptyState
          icon={UserCircle}
          title="No members yet"
          description="Invite your first member to collaborate."
          action={<Button onClick={() => setShowInvite(true)}>Invite Member</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {memberRows.map((member) => {
            const access = member.memberships || member.access_rights || [];
            const primaryRole = access[0]?.role || "member";
            const memberTeams = teams.filter((team) =>
              access.some((entry) => (entry.team_ids || []).includes(team._id))
            );

            return (
              <div key={member._id} className="bg-card border rounded-2xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <UserCircle className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{member.displayName}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {member.phone}
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setAccessMember(member)}>
                    <Settings2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <Badge className={ROLE_STYLE[primaryRole] || ROLE_STYLE.member}>{primaryRole}</Badge>
                  {memberTeams.map((team) => (
                    <Badge key={team._id} variant="secondary">{team.name}</Badge>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Member</DialogTitle>
            <DialogDescription>Send a workspace invitation to an existing user.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleInvite} className="space-y-4">
            <div>
              <Label>Phone</Label>
              <Input
                value={inviteForm.phone}
                onChange={(e) => setInviteForm({ ...inviteForm, phone: e.target.value })}
                placeholder="Phone number"
                required
              />
            </div>

            <div>
              <Label>Workspace</Label>
              <Select
                value={inviteForm.workspace_id}
                onValueChange={(value) => setInviteForm({ ...inviteForm, workspace_id: value })}
              >
                <SelectTrigger><SelectValue placeholder="Select workspace" /></SelectTrigger>
                <SelectContent>
                  {workspaces.map((workspace) => (
                    <SelectItem key={workspace._id} value={workspace._id}>{workspace.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Role</Label>
              <Select
                value={inviteForm.role}
                onValueChange={(value) => setInviteForm({ ...inviteForm, role: value })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setShowInvite(false)}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1">Send Invite</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <MemberAccessDialog
        open={!!accessMember}
        onOpenChange={(open) => !open && setAccessMember(null)}
        member={accessMember}
        teams={teams}
        workspaces={workspaces}
      />
    </div>
  );
}
