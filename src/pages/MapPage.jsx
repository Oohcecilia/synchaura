import { useState, useMemo, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { useAppData } from "@/lib/DataProvider";
import { MapPin } from "lucide-react";
import EmptyState from "../components/EmptyState";
import TaskFormDialog from "../components/TaskFormDialog";
import TaskDetailDialog from "../components/TaskDetailDialog";
import TaskRoute from "../components/TaskRoute";
import UserLocationMarker from "../components/UserLocationMarker";
import LocateMeButton from "../components/LocateMeButton";
import LocationPermissionBanner from "../components/LocationPermissionBanner";
import useGeolocation from "../hooks/useGeolocation";
import useRoute from "../hooks/useRoute";
import "leaflet/dist/leaflet.css";
import { getSavedTheme, applyTheme } from "@/utils/theme";
import { ensureLeafletDefaultIcons } from "@/lib/leaflet-icons";

ensureLeafletDefaultIcons();

function FocusTaskOnMap({ task }) {
  const map = useMap();

  useEffect(() => {
    if (task?.latitude == null || task?.longitude == null) return;

    const maxZoom = typeof map.getMaxZoom === "function" ? map.getMaxZoom() : 19;
    map.setView([task.latitude, task.longitude], Number.isFinite(maxZoom) ? maxZoom : 19, { animate: true });
  }, [map, task?.latitude, task?.longitude]);

  return null;
}

/**
 * Inner component that bridges imperative Leaflet map access
 * with the LocateMeButton component.
 */
function LocateMeInner({ onClick, loading, disabled }) {
  const map = useMap();

  const handleClick = useCallback(() => {
    if (onClick) onClick(map);
  }, [map, onClick]);

  return (
    <LocateMeButton onClick={handleClick} loading={loading} disabled={disabled} />
  );
}

export default function MapPage() {
  const location = useLocation();

  const {
    tasks,
    teams,
    members,
    workspaces,
    loading,
    reload,
  } = useAppData();

  const [selectedTask, setSelectedTask] = useState(
    // Restore task passed via router state from TaskDetailDialog's Navigate button
    location.state?.task ?? null
  );
  const [showForm, setShowForm] = useState(false);

  const {
    position: userPosition,
    loading: geoLoading,
    permissionState,
    refreshLocation,
  } = useGeolocation();

  const {
    route,
    distance,
    duration,
    loading: routeLoading,
    error: routeError,
    fetchRoute,
    clearRoute,
  } = useRoute();

  useEffect(() => {
    const theme = getSavedTheme();
    applyTheme(theme);
  }, []);

  // Auto-fetch route when a task is selected and user position is available
  useEffect(() => {
    if (selectedTask && userPosition) {
      fetchRoute(userPosition, {
        lat: selectedTask.latitude,
        lng: selectedTask.longitude,
      });
    } else if (!selectedTask) {
      clearRoute();
    }
  }, [selectedTask, userPosition, fetchRoute, clearRoute]);

  const handleLocateMe = useCallback(
    (map) => {
      refreshLocation();
      if (userPosition) {
        map.flyTo([userPosition.lat, userPosition.lng], 14, { duration: 1 });
      }
    },
    [refreshLocation, userPosition]
  );

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
          <div className="relative z-0 lg:col-span-2 h-[500px] rounded-2xl overflow-hidden border">
            {/* Permission banner — positioned over the map */}
            <LocationPermissionBanner permissionState={permissionState} />

            <MapContainer center={center} zoom={12} className="h-full w-full relative z-0">
              <FocusTaskOnMap task={selectedTask} />

              {/* User's current location marker */}
              {userPosition && <UserLocationMarker position={userPosition} flyTo={true} />}

              {/* Navigation route polyline */}
              <TaskRoute
                route={route}
                distance={distance}
                duration={duration}
                loading={routeLoading}
                error={routeError}
              />

              {/* Locate me button — rendered inside MapContainer for map access */}
              <LocateMeInner
                onClick={handleLocateMe}
                loading={geoLoading}
                disabled={permissionState === "denied"}
              />

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
                      {/* Show route summary in popup when this task has an active route */}
                      {selectedTask?._id === task._id && distance != null && (
                        <p className="text-xs text-primary font-medium mt-1">
                          {(distance / 1000).toFixed(1)} km · {Math.round(duration / 60)} min
                        </p>
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
                }}
                className={`w-full text-left bg-card border rounded-xl p-3 hover:shadow-md transition-all ${
                  selectedTask?._id === task._id ? "ring-2 ring-primary border-primary" : ""
                }`}
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

      <TaskDetailDialog
        open={!!selectedTask}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedTask(null);
            clearRoute();
          }
        }}
        task={selectedTask}
        members={members}
        onEdit={(task) => {
          setSelectedTask(task);
          setShowForm(true);
        }}
        onDeleted={() => {
          setSelectedTask(null);
          clearRoute();
          reload();
        }}
      />

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
