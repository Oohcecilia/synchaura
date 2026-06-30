import "@testing-library/jest-dom";

// Polyfill ResizeObserver for Radix UI components
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = ResizeObserverMock;

// Mock lucide-react icons (render as accessible inline SVG elements)
import React from "react";

const iconMock = (name) => {
  const Icon = (props) => React.createElement("svg", {
    "data-icon": name,
    ...props,
    "data-testid": `icon-${name}`,
  });
  Icon.displayName = name;
  return Icon;
};

vi.mock("lucide-react", () => {
  const icons = [
    "Calendar", "MapPin", "Users", "CheckCircle2", "Clock",
    "RefreshCw", "RotateCcw", "Plus", "Loader2", "Bot",
    "FileText", "MessageSquare", "Play", "Square", "TrendingUp",
    "Edit", "Trash2", "Pencil", "X", "Check", "Search",
    "ChevronDown", "ChevronUp", "ArrowRight", "Settings",
    "Navigation", "Paperclip", "Upload", "Download",
  ];
  const mockIcons = {};
  icons.forEach((name) => {
    mockIcons[name] = iconMock(name);
  });
  // Default export for dynamic imports
  mockIcons.default = new Proxy({}, { get: (_, name) => mockIcons[name] || iconMock(name) });
  return mockIcons;
});

// Mock PouchDB
vi.mock("@/db/couch", () => ({
  getDB: vi.fn(() => ({
    put: vi.fn().mockResolvedValue({ ok: true, id: "mock_doc", rev: "1-abc" }),
    get: vi.fn().mockResolvedValue({ _id: "mock_doc", _rev: "1-abc" }),
    remove: vi.fn().mockResolvedValue({ ok: true }),
    find: vi.fn().mockResolvedValue({ docs: [] }),
    allDocs: vi.fn().mockResolvedValue({ rows: [] }),
    close: vi.fn(),
    destroy: vi.fn(),
  })),
  getDocsByType: vi.fn().mockResolvedValue([]),
  getDocsByTypes: vi.fn().mockResolvedValue([]),
  closeLocalDB: vi.fn(),
  destroyLocalDB: vi.fn(),
}));

// Mock AuthContext
vi.mock("@/lib/AuthContext", () => ({
  useAuth: vi.fn(() => ({
    user: { id: "user_1", _id: "user_1", first_name: "Test", last_name: "User" },
    session: { userId: "user_1", token: "mock-token" },
    memberships: [{ workspace_id: "ws_1", role: "owner", team_ids: [] }],
    hasFullAccess: true,
    hasOwnerAccess: true,
    isAuthenticated: true,
    isLoadingAuth: false,
    setUser: vi.fn(),
    setMemberships: vi.fn(),
    setAuthError: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
    changePassword: vi.fn(),
    completeOAuthSession: vi.fn(),
  })),
  AuthProvider: ({ children }) => children,
}));

// Mock notifications
vi.mock("@/db/notification", () => ({
  createNotification: vi.fn().mockResolvedValue({}),
  ensureDueTaskNotifications: vi.fn().mockResolvedValue([]),
  isNotificationVisibleToUser: vi.fn().mockReturnValue(true),
}));

// Mock react-router-dom
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: vi.fn(() => vi.fn()),
    useLocation: vi.fn(() => ({ pathname: "/" })),
    useSearchParams: vi.fn(() => [new URLSearchParams(), vi.fn()]),
  };
});

// Mock nanoid
vi.mock("nanoid", () => ({
  nanoid: vi.fn(() => "test-nanoid-123"),
}));

// Mock shadcn Dialog (Radix-based) — it uses portals which render outside the test container
// Radix Dialog should work with jsdom since it renders to body via portal.
// We just need to ensure body is available.

// Mock leaflet (used by LocationPicker)
vi.mock("leaflet", () => ({
  Icon: { Default: { prototype: { _getIconUrl: vi.fn() }, mergeOptions: vi.fn() } },
  default: {
    Icon: { Default: { prototype: { _getIconUrl: vi.fn() }, mergeOptions: vi.fn() } },
    Control: { Zoom: vi.fn() },
    Map: vi.fn(),
    Marker: vi.fn(),
    TileLayer: vi.fn(),
    Popup: vi.fn(),
  },
}));

// Mock react-leaflet
vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }) => `<div data-testid="map-container">${children}</div>`,
  TileLayer: () => null,
  Marker: () => null,
  Popup: () => null,
  useMap: () => ({}),
  useMapEvents: () => ({}),
}));

// Mock LocationPicker (depends on react-leaflet)
vi.mock("@/components/LocationPicker", () => ({
  default: ({ value, onChange }) =>
    React.createElement("div", { "data-testid": "location-picker" },
      `Location: ${value?.location_name || "none"}`
    ),
}));

// Mock RecurringSettings
vi.mock("@/components/RecurringSettings", () => ({
  default: ({ form, setForm }) =>
    React.createElement("div", { "data-testid": "recurring-settings" },
      `Recurring: ${form.recurring_interval}`
    ),
}));
