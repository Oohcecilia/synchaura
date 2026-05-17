import { useState, useEffect, useCallback, useRef } from "react";
import {
  Bell,
  CheckCheck,
  X,
  CheckSquare,
  RefreshCw,
  SquareChevronDown,
  UserPlus,
  Mail,
  Info
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@/lib/AuthContext";
import { getNotifications } from "@/db/api";
import usePouchChanges from "@/hooks/usePouchChanges";
import { getDB } from "@/db/couch";


const typeConfig = {
  task_created: {
    icon: SquareChevronDown,
    color: "text-blue-500",
    bg: "bg-blue-100 dark:bg-blue-900/30",
  },

  task_updated: {
    icon: CheckSquare,
    color: "text-emerald-500",
    bg: "bg-orange-100 dark:bg-orange-900/30",
  },

  task_completed: {
    icon: CheckCheck,
    color: "text-emerald-500",
    bg: "bg-emerald-100 dark:bg-emerald-900/30",
  },

  task_assigned: {
    icon: UserPlus,
    color: "text-purple-500",
    bg: "bg-purple-100 dark:bg-purple-900/30",
  },

  invitation: {
    icon: Mail,
    color: "text-pink-500",
    bg: "bg-pink-100 dark:bg-pink-900/30",
  },

  info: {
    icon: Info,
    color: "text-sky-500",
    bg: "bg-emerald-100 dark:bg-emerald-900/30",
  },
};

const positionClass = {
  right: "right-0",
  left: "left-0",
  center: "left-1/2 -translate-x-1/2",
};

export default function NotificationBell({ position = "right" }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const [shouldReload, setShouldReload] = useState(false);


  // ----------------------------
  // LOAD NOTIFICATIONS
  // ----------------------------
  const load = useCallback(async () => {
    if (!user?.user?.id) return;

    const userId = user.user.id;

    try {
      const res = await getNotifications(userId);

      const notifications = res?.notifications || [];

      setNotifications(notifications);

      const unread = notifications.filter((n) => {
        const readList = Array.isArray(n.read)
          ? n.read
          : [];

        return !readList.includes(userId);
      }).length;

      setUnreadCount(unread);

    } catch (err) {
      console.error("Failed to load notifications:", err);
    }
  }, [user]);


  usePouchChanges(user, (doc) => {
    if (!doc) return;

    setNotifications((prev) => {
      const exists = prev.find(n => n._id === doc._id);

      if (exists) {
        // 🔁 update existing
        return prev.map(n => n._id === doc._id ? doc : n);
      } else {
        // ➕ add new
        return [doc, ...prev];
      }
    });

    // 🔥 update unread count in real-time
    setUnreadCount((prev) => {
      const isUnread = !(doc.read || []).includes(user.id);
      return isUnread ? prev + 1 : prev;
    });

  }, 'notification');


  // ----------------------------
  // INIT LOAD
  // ----------------------------
  useEffect(() => {
    load(); // ✅ initial fetch

    const handler = () => {
      load(); // ✅ refresh on trigger
    };

    window.addEventListener("notifications:changed", handler);

    return () => {
      window.removeEventListener("notifications:changed", handler);
    };
  }, [load]);


  useEffect(() => {

    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);



  const acceptInvitation = async (notif) => {
    try {
      const db = getDB(user?.id);
      if (!db) return;

      // =========================
      // 1. UPDATE USER PERMISSIONS
      // =========================
      const targetUser = await db.get(notif.user_id);

      const currentAccess = Array.isArray(targetUser.access_rights)
        ? targetUser.access_rights
        : [];

      const exists = currentAccess.find(
        (a) => a.org_id === notif.org_id
      );

      const updatedAccess = exists
        ? currentAccess.map((a) =>
          a.org_id === notif.org_id
            ? { ...a, role: notif.role || "member" }
            : a
        )
        : [
          ...currentAccess,
          {
            org_id: notif.org_id,
            role: notif.role || "member",
          },
        ];

      const updatedUser = {
        ...targetUser,
        access_rights: updatedAccess,
        updated_at: new Date().toISOString(),
      };

      await db.put(updatedUser);

      // update session if current user
      if (notif.user_id === user?.id) {
        sessionStorage.setItem("user", JSON.stringify(updatedUser));
      }

      // =========================
      // 2. UPDATE NOTIFICATION
      // =========================
      const freshNotif = await db.get(notif._id);

      const readList = Array.isArray(freshNotif.read)
        ? freshNotif.read
        : [];

      const updatedRead = readList.includes(user?.id)
        ? readList
        : [...readList, user?.id];

      const updatedNotif = {
        ...freshNotif,
        status: "accepted",
        read: updatedRead,
        updated_at: new Date().toISOString(),
      };

      await db.put(updatedNotif);

      // =========================
      // 3. UPDATE UI STATE (IMPORTANT)
      // =========================
      setNotifications((prev) =>
        prev.map((n) =>
          n._id === notif._id
            ? {
              ...n,
              status: "accepted",
              read: updatedRead,
            }
            : n
        )
      );

      // optional: keep unread count consistent
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error("❌ Accept invitation failed:", err);
    }
  };


  const rejectInvitation = async (notif) => {
    try {
      const db = getDB(user?.id);
      if (!db) return;

      const freshNotif = await db.get(notif._id);
      const readList = Array.isArray(freshNotif.read) ? freshNotif.read : [];

      const updatedNotif = {
        ...freshNotif,
        status: "rejected",
        read: readList.includes(user.id) ? readList : [...readList, user.id],
        updated_at: new Date().toISOString(),
      };

      await db.put(updatedNotif);
    } catch (err) {
      console.error("❌ Reject invitation failed:", err);
    }
  };

  /**
   * OPTIMIZED: Mark All Read
   * Uses bulkDocs to perform a single write operation instead of a loop.
   */
  const markAllRead = async () => {
    try {
      const db = getDB(user?.id);
      if (!db || !notifications.length) return;

      const now = new Date().toISOString();

      // Prepare all documents for a bulk update
      const docsToUpdate = notifications.map((n) => {
        const currentRead = Array.isArray(n.read) ? n.read : [];
        return {
          ...n,
          read: currentRead.includes(user?.id) ? currentRead : [...currentRead, user?.id],
          updated_at: now,
        };
      });

      // PouchDB high-performance batch write
      await db.bulkDocs(docsToUpdate);

      // Manual UI Reset if not using the live listener hook
      setUnreadCount(0);

    } catch (err) {
      console.error("❌ Failed to mark all as read:", err);
    }
  };

  // ----------------------------
  // MARK SINGLE READ (UI ONLY)
  // ----------------------------
  const markRead = async (notif) => {
    if (!user?.id) return;

    try {
      const db = getDB(user.id);
      if (!db) return;


      // 1. Prepare the updated read list
      const currentRead = Array.isArray(notif.read) ? notif.read : [];

      // If already read, don't do anything
      if (currentRead.includes(user.id)) return;

      const updatedRead = [...currentRead, user.id];

      // 2. Build the updated document
      // IMPORTANT: PouchDB requires the existing doc (which includes the _rev) 
      // to update correctly.
      const updatedNotif = {
        ...notif,
        read: updatedRead,
        updated_at: new Date().toISOString(),
      };

      // 3. Save to PouchDB (Local)
      // This will automatically trigger your sync.js to push to CouchDB
      await db.put(updatedNotif);


      // OPTIONAL: Manual UI update if you aren't using the hook yet
      setNotifications((prev) =>
        prev.map((n) =>
          n._id === notif._id ? { ...n, read: updatedRead } : n
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

    } catch (err) {
      console.error("❌ Failed to mark notification as read:", err);
    }
  };


  return (
    <div className="relative" ref={ref}>
      {/* Bell Button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 hover:bg-muted rounded-xl transition-colors"
      >
        <Bell className="h-5 w-5" />

        {unreadCount > 0 && (
          <span className="absolute top-1 right-0 h-4 w-4 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className={cn(
            "absolute mt-2 w-80 bg-card border border-border rounded-2xl shadow-xl z-50 overflow-hidden",
            positionClass[position]
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold">Notifications</h3>

            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  <CheckCheck className="h-3 w-3" />
                  Mark all read
                </button>
              )}

              <button
                onClick={() => setOpen(false)}
                className="p-1 hover:bg-muted rounded-lg"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                No notifications yet
              </div>
            ) : (
              notifications.map((n) => {

                const cfg = typeConfig[n.category] || typeConfig.info;
                const Icon = cfg.icon;
                const isInvitation = n.category === "invitation";
                const isProcessed = n.status === "accepted" || n.status === "rejected";

                const readList = Array.isArray(n.read) ? n.read : [];
                const isUnread = !readList.includes(user?.id);

                return (
                  <div
                    key={n._id}
                    onClick={() => !isInvitation && markRead(n)}
                    className={cn(
                      "flex items-start gap-3 px-4 py-3 transition-colors border-b border-border last:border-0",
                      isUnread && "bg-primary/5",
                      !isInvitation && "cursor-pointer hover:bg-muted/50"
                    )}
                  >
                    {/* Icon */}
                    <div
                      className={cn(
                        "h-8 w-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5",
                        cfg.bg
                      )}
                    >
                      <Icon className={cn("h-4 w-4", cfg.color)} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p
                        className={cn(
                          "text-xs font-semibold",
                          isUnread && "text-foreground"
                        )}
                      >
                        {n.title}
                      </p>

                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {n.message}
                      </p>

                      <p className="text-[10px] text-muted-foreground mt-1">
                        {formatDistanceToNow(
                          new Date(n.created_at || Date.now()),
                          { addSuffix: true }
                        )}
                      </p>

                      {/* =========================
                INVITATION ACTIONS
            ========================= */}
                      {isInvitation && (
                        <div className="flex gap-2 mt-2">

                          {/* ACCEPT */}
                          <button
                            disabled={n.status === "accepted" || n.status === "rejected"}
                            onClick={(e) => {
                              e.stopPropagation();
                              acceptInvitation(n);
                            }}
                            className={cn(
                              "text-[10px] px-2 py-1 rounded-md text-white transition",
                              n.status === "accepted" || n.status === "rejected"
                                ? "bg-gray-400 cursor-not-allowed"
                                : "bg-green-500 hover:bg-green-600"
                            )}
                          >
                            {n.status === "accepted" ? "Accepted" : "Accept"}
                          </button>

                          {/* REJECT */}
                          <button
                            disabled={n.status === "accepted" || n.status === "rejected"}
                            onClick={(e) => {
                              e.stopPropagation();
                              rejectInvitation(n);
                            }}
                            className={cn(
                              "text-[10px] px-2 py-1 rounded-md text-white transition",
                              n.status === "accepted" || n.status === "rejected"
                                ? "bg-gray-400 cursor-not-allowed"
                                : "bg-red-500 hover:bg-red-600"
                            )}
                          >
                            {n.status === "rejected" ? "Cancelled" : "Cancel"}
                          </button>

                        </div>
                      )}
                    </div>

                    {/* Unread dot (only for non-invitations OR unread ones) */}
                    {isUnread && !isInvitation && (
                      <div className="h-2 w-2 rounded-full bg-primary mt-1 shrink-0" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}