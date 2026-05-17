import { useState, useMemo, useEffect } from "react";
import { UserCircle, Phone, Users, Shield, UserPlus, Loader2, Settings2 } from "lucide-react";
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
  member: "bg-primary/10 text-primary",
  manager: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  admin: "bg-muted text-muted-foreground",
};

export default function Members() {
  const { user } = useAuth();

  // ✅ GLOBAL REAL-TIME DATA
  const {
    members,
    teams,
    workspaces,
    userList,
    loading,
  } = useAppData();

  const [accessMember, setAccessMember] = useState(null);

  const [showInvite, setShowInvite] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const [inviting, setInviting] = useState(false);

  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedOrg, setSelectedOrg] = useState("");
  const [phoneQuery, setPhoneQuery] = useState("");
  const [showPhoneDropdown, setShowPhoneDropdown] = useState(false);

  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("theme");
    return saved ? saved === "dark" : false;
  });

  // -------------------------
  // THEME
  // -------------------------
  useEffect(() => {
    const theme = getSavedTheme();
    setDarkMode(applyTheme(theme));
  }, []);

  // -------------------------
  // FILTER USERS (MEMORY OPTIMIZED)
  // -------------------------
  const filteredUsers = useMemo(() => {
    return (userList ?? []).filter((u) =>
      (u.phone || "")
        .toLowerCase()
        .includes(phoneQuery.toLowerCase())
    );
  }, [userList, phoneQuery]);

  const currentUser = members.find((m) => m._id === user?.id);
  const otherMembers = members.filter((m) => m._id !== user?.id);

  // -------------------------
  // INVITE USER
  // -------------------------
  const handleInvite = async (e) => {
    e.preventDefault();
    setInviting(true);

    const selectedOrgName =
      workspaces.find((o) => o._id === selectedOrg)?.name || "";

    try {
      await createNotification(
        {
          type: "invitation",
          title: "Invitation Received",
          message: `${user?.id} invited you to join ${selectedOrgName}.`,
          org_id: selectedOrg,
          user_id: selectedUserId,
          created_by: user?.id,
        },
        user?.id
      );

      setInviteSuccess(true);

      setTimeout(() => {
        setInviteSuccess(false);
        setShowInvite(false);
      }, 1200);

      setPhoneQuery("");
      setSelectedUserId("");
      setSelectedOrg("");
      setShowPhoneDropdown(false);
    } catch (err) {
      console.error("Invite error:", err);
    } finally {
      setInviting(false);
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
  // TEAM MAP
  // -------------------------
  const teamMap = Object.fromEntries(
    (teams || []).map((t) => [t._id, t])
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6">

      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Members</h1>
          <p className="text-sm text-muted-foreground">
            {members.length} members
          </p>
        </div>

        <Button onClick={() => setShowInvite(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Invite
        </Button>
      </div>

      {/* EMPTY */}
      {members.length === 0 ? (
        <EmptyState
          icon={UserCircle}
          title="No members yet"
          description="Invite members to your workspace"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[currentUser, ...otherMembers]
            .filter(Boolean)
            .map((member) => {
              const memberTeams = (member.team_ids || [])
                .map((id) => teamMap[id])
                .filter(Boolean);

              return (
                <div
                  key={member._id}
                  className="bg-card border rounded-2xl p-5"
                >
                  {/* USER */}
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-bold text-primary">
                        {(member.first_name || member.phone || "?")
                          .charAt(0)
                          .toUpperCase()}
                      </span>
                    </div>

                    <div>
                      <h3 className="font-semibold text-sm">
                        {member.first_name} {member.last_name}
                        {member._id === user?.id && (
                          <span className="ml-1 text-primary text-[10px]">
                            (You)
                          </span>
                        )}
                      </h3>

                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {member.phone}
                      </p>
                    </div>
                  </div>

                  {/* TEAMS */}
                  {memberTeams.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {memberTeams.map((t) => (
                        <Badge
                          key={t._id}
                          variant="secondary"
                          className="text-[10px]"
                        >
                          {t.name}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-4"
                    onClick={() => setAccessMember(member)}
                  >
                    <Settings2 className="h-3.5 w-3.5 mr-1.5" />
                    Manage Access
                  </Button>
                </div>
              );
            })}
        </div>
      )}

      {/* ACCESS DIALOG */}
      {accessMember && (
        <MemberAccessDialog
          open={true}
          onOpenChange={(v) => {
            if (!v) setAccessMember(null);
          }}
          member={accessMember}
          teams={teams}
          workspaces={workspaces}
        />
      )}

      {/* INVITE DIALOG */}
      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent className="max-w-sm">

          <DialogHeader>
            <DialogTitle>Invite Member</DialogTitle>
            <DialogDescription>
              Send invitation to a user.
            </DialogDescription>
          </DialogHeader>

          {inviteSuccess ? (
            <div className="py-6 text-center">
              <UserPlus className="mx-auto mb-2 text-emerald-500" />
              <p>Invitation sent!</p>
            </div>
          ) : (
            <form onSubmit={handleInvite} className="space-y-4">

              {/* PHONE SEARCH */}
              <div>
                <Label>Phone</Label>
                <div className="relative">
                  <Input
                    type="number"
                    value={phoneQuery}
                    onChange={(e) => {
                      setPhoneQuery(e.target.value);
                      setShowPhoneDropdown(true);
                      setSelectedUserId(""); // reset selection when typing
                    }}
                    onFocus={() => setShowPhoneDropdown(true)}
                    placeholder="Search phone number..."
                    required
                    className="
      bg-white text-gray-900 border-gray-300
      dark:bg-gray-900 dark:text-gray-100 dark:border-gray-700
      placeholder:text-gray-400 dark:placeholder:text-gray-500
      focus-visible:ring-2 focus-visible:ring-blue-500
    "
                  />

                  {showPhoneDropdown && phoneQuery && (
                    <div
                      className="
        absolute z-50 mt-1 w-full
        bg-white border rounded-md shadow max-h-40 overflow-y-auto
        dark:bg-gray-900 dark:border-gray-700
      "
                    >
                      {filteredUsers.length > 0 ? (
                        filteredUsers.map((u) => (
                          <div
                            key={u.user_id}
                            className="
              px-3 py-2 text-sm cursor-pointer
              text-gray-900 hover:bg-gray-100
              dark:text-gray-100 dark:hover:bg-gray-800
            "
                            onClick={() => {
                              setPhoneQuery(u.phone);
                              setSelectedUserId(u.user_id);
                              setShowPhoneDropdown(false);
                            }}
                          >
                            {u.phone} - {u.first_name}
                          </div>
                        ))
                      ) : (
                        <div className="px-3 py-2 text-sm text-gray-400 dark:text-gray-500">
                          No phone number found
                        </div>
                      )}
                    </div>
                  )}
                </div>              </div>

              {/* ORG */}
              <div>
                <Label>Organization</Label>
                <Select
                  value={selectedOrg}
                  onValueChange={setSelectedOrg}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select org" />
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

              <Button
                type="submit"
                className="w-full"
                disabled={!selectedUserId || !selectedOrg || inviting}
              >
                {inviting ? "Sending..." : "Send Invite"}
              </Button>

            </form>
          )}
        </DialogContent>
      </Dialog >

    </div >
  );
}