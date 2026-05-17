import { useState, useMemo, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { useAppData } from "@/lib/DataProvider";
import { MapPin } from "lucide-react";
import EmptyState from "../components/EmptyState";
import TaskFormDialog from "../components/TaskFormDialog";
import "leaflet/dist/leaflet.css";
import { getSavedTheme, applyTheme } from "@/utils/theme";
import { useAuth } from "@/lib/AuthContext";
import { fetchedUserData } from "@/db/api";

import L from "leaflet";
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

export default function MapPage() {
  const { user } = useAuth();

  // ✅ GLOBAL SYNCED DATA (NO FETCHING HERE)
  const {
    tasks,
    teams,
    members,
    workspaces,
    loading,
  } = useAppData();

  const [showForm, setShowForm] = useState(false);
  const [editTask, setEditTask] = useState(null);

  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("theme");
    return saved ? saved === "dark" : false;
  });

  // theme
  useEffect(() => {
    const theme = getSavedTheme();
    setDarkMode(applyTheme(theme));
  }, []);

  // -----------------------------
  // FILTER LOCATED TASKS
  // -----------------------------
  const locatedTasks = useMemo(() => {
    return (tasks ?? []).filter(
      (t) =>
        t.latitude != null &&
        t.longitude != null &&
        !isNaN(t.latitude) &&
        !isNaN(t.longitude)
    );
  }, [tasks]);

  const center =
    locatedTasks.length > 0
      ? [
          Number(locatedTasks[0].latitude),
          Number(locatedTasks[0].longitude),
        ]
      : [14.5995, 120.9842]; // Manila fallback

  // -----------------------------
  // LOADING
  // -----------------------------
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
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
          Location
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {locatedTasks.length} tasks with locations
        </p>
      </div>

      {/* EMPTY STATE */}
      {locatedTasks.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No located tasks"
          description="Add latitude and longitude to your tasks to see them on the map"
        />
      ) : (
        <div
          className="bg-card border border-border rounded-2xl overflow-hidden"
          style={{ height: "500px", position: "relative", zIndex: 0 }}
        >
          <MapContainer
            center={center}
            zoom={10}
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer
              attribution="&copy; OpenStreetMap"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {locatedTasks.map((task) => (
              <Marker
                key={task._id}
                position={[
                  Number(task.latitude),
                  Number(task.longitude),
                ]}
              >
                <Popup>
                  <div className="min-w-[150px]">
                    <p className="font-semibold text-sm">
                      {task.title}
                    </p>

                    {task.location_name && (
                      <p className="text-xs text-gray-500">
                        {task.location_name}
                      </p>
                    )}

                    <button
                      onClick={() => {
                        setEditTask(task);
                        setShowForm(true);
                      }}
                      className="text-xs text-blue-600 mt-1 underline"
                    >
                      Edit Task
                    </button>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      )}

      {/* LIST */}
      {locatedTasks.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">
            Tasks with Locations
          </h3>

          {locatedTasks.map((task) => (
            <div
              key={task._id}
              onClick={() => {
                setEditTask(task);
                setShowForm(true);
              }}
              className="bg-card border border-border rounded-xl p-3 cursor-pointer hover:shadow-md transition-all flex items-center gap-3"
            >
              <MapPin className="h-4 w-4 text-primary shrink-0" />

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {task.title}
                </p>

                <p className="text-xs text-muted-foreground">
                  {task.location_name ||
                    `${task.latitude}, ${task.longitude}`}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* FORM */}
      <TaskFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        task={editTask}
        teams={teams}
        members={members}
        workspaces={workspaces}
      />
    </div>
  );
}