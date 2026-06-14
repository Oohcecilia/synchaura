import { useState, useMemo, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { useAppData } from "@/lib/DataProvider";
import { MapPin } from "lucide-react";
import EmptyState from "../components/EmptyState";
import TaskFormDialog from "../components/TaskFormDialog";
import "leaflet/dist/leaflet.css";
import { getSavedTheme, applyTheme } from "@/utils/theme";
import { useAuth } from "@/lib/AuthContext";
import { ensureLeafletDefaultIcons } from "@/lib/leaflet-icons";

ensureLeafletDefaultIcons();

export default function MapPage() {
  const { user } = useAuth();

  const {
    tasks,
    teams,
    members,
    workspaces,
    loading,
    reload,
  } = useAppData();

  const [selectedTask, setSelectedTask] = useState(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const theme = getSavedTheme();
    applyTheme(theme);
  }, []);

  const tasksWithLocation = useMemo(() => {
    return (tasks || []).filter(
      (task) =>
        task.latitude !== null &&
        task.latitude !== undefined &&
        task.longitude !== null &&
        task.longitude !== undefined
    );
  }, [tasks]);

  const center = useMemo(() => {
    if (tasksWithLocation.length) {
      return [tasksWithLocation[0].latitude, tasksWithLocation[0].longitude];
    }
    return [14.5995, 120.9842];
  }, [tasksWithLocation]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
          Location
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          View tasks by location
        </p>
      </div>

      {tasksWithLocation.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No task locations yet"
          description="Add a location to a task to show it on the map"
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 h-[500px] rounded-2xl overflow-hidden border">
            <MapContainer center={center} zoom={12} className="h-full w-full">
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {tasksWithLocation.map((task) => (
                <Marker
                  key={task._id}
                  position={[task.latitude, task.longitude]}
                  eventHandlers={{
                    click: () => setSelectedTask(task),
                  }}
                >
                  <Popup>
                    <div className="space-y-1">
                      <p className="font-medium text-sm">{task.title}</p>
                      {task.location_name && (
                        <p className="text-xs text-muted-foreground">{task.location_name}</p>
                      )}
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>

          <div className="space-y-2">
            {tasksWithLocation.map((task) => (
              <button
                key={task._id}
                onClick={() => {
                  setSelectedTask(task);
                  setShowForm(true);
                }}
                className="w-full text-left bg-card border rounded-xl p-3 hover:shadow-md transition-all"
              >
                <p className="text-sm font-medium">{task.title}</p>
                <p className="text-xs text-muted-foreground">
                  {task.location_name || `${task.latitude}, ${task.longitude}`}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      <TaskFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        task={selectedTask}
        teams={teams}
        members={members}
        workspaces={workspaces}
        onSaved={reload}
      />
    </div>
  );
}
