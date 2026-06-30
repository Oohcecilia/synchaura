import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import useGeolocation from "../useGeolocation";

/**
 * Creates a mock Position object simulating the Geolocation API response.
 */
function mockPosition(lat = 14.5995, lng = 120.9842) {
  return {
    coords: {
      latitude: lat,
      longitude: lng,
      accuracy: 10,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
    },
    timestamp: Date.now(),
  };
}

/**
 * Factory for GeolocationPositionError-like objects.
 */
function createGeoError(code, message) {
  const error = new Error(message);
  error.code = code;
  error.PERMISSION_DENIED = 1;
  error.POSITION_UNAVAILABLE = 2;
  error.TIMEOUT = 3;
  return error;
}

let successCallback = null;
let errorCallback = null;
let optionsArg = null;
let mockPermissionListeners = [];

/**
 * Resets all mocks before each test so state is clean.
 */
beforeEach(() => {
  successCallback = null;
  errorCallback = null;
  optionsArg = null;
  mockPermissionListeners = [];

  // Mock navigator.geolocation
  Object.defineProperty(global.navigator, "geolocation", {
    value: {
      getCurrentPosition: vi.fn((success, error, options) => {
        successCallback = success;
        errorCallback = error;
        optionsArg = options;
      }),
      clearWatch: vi.fn(),
      watchPosition: vi.fn(),
    },
    configurable: true,
    writable: true,
  });

  // Mock navigator.permissions
  Object.defineProperty(global.navigator, "permissions", {
    value: {
      query: vi.fn().mockResolvedValue({
        state: "prompt",
        addEventListener: vi.fn((event, handler) => {
          mockPermissionListeners.push({ event, handler });
        }),
        removeEventListener: vi.fn(),
      }),
    },
    configurable: true,
    writable: true,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  // Clean up the injected style element from UserLocationMarker if present
  const styleEl = document.getElementById("user-location-style");
  if (styleEl) styleEl.remove();
});

// ============================================================
// GEOLOCATION NOT SUPPORTED
// ============================================================
describe("geolocation not supported", () => {
  it("sets unavailable state when navigator.geolocation is missing", () => {
    Object.defineProperty(global.navigator, "geolocation", {
      value: undefined,
      configurable: true,
    });

    const { result } = renderHook(() => useGeolocation());

    expect(result.current.position).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.permissionState).toBe("unavailable");
    expect(result.current.error).toBe("Geolocation is not supported by this browser.");
  });
});

// ============================================================
// PERMISSIONS API
// ============================================================
describe("Permissions API integration", () => {
  it("reads initial permission state from Permissions API when granted", async () => {
    // Override to return granted
    global.navigator.permissions.query = vi.fn().mockResolvedValue({
      state: "granted",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });

    const { result } = renderHook(() => useGeolocation());

    await waitFor(() => {
      expect(global.navigator.permissions.query).toHaveBeenCalledWith({
        name: "geolocation",
      });
    });

    // Permission state should be granted
    expect(result.current.permissionState).toBe("granted");

    // Since permission is granted, getCurrentPosition should have been called
    expect(global.navigator.geolocation.getCurrentPosition).toHaveBeenCalled();

    // Simulate position success
    act(() => {
      successCallback(mockPosition(10.0, 11.0));
    });

    expect(result.current.position).toEqual({ lat: 10.0, lng: 11.0 });
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("reads initial permission state when denied", async () => {
    global.navigator.permissions.query = vi.fn().mockResolvedValue({
      state: "denied",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });

    const { result } = renderHook(() => useGeolocation());

    await waitFor(() => {
      expect(result.current.permissionState).toBe("denied");
    });

    // getCurrentPosition should still be called (browser will show denied error)
    expect(global.navigator.geolocation.getCurrentPosition).toHaveBeenCalled();
  });

  it("handles permissions API not being available", () => {
    Object.defineProperty(global.navigator, "permissions", {
      value: undefined,
      configurable: true,
    });

    const { result } = renderHook(() => useGeolocation());

    // Should still call getCurrentPosition (will prompt the user)
    expect(global.navigator.geolocation.getCurrentPosition).toHaveBeenCalled();
    expect(result.current.permissionState).toBe("prompt");
  });

  it("registers a change listener on the permission status", async () => {
    const addEventListenerSpy = vi.fn();
    global.navigator.permissions.query = vi.fn().mockResolvedValue({
      state: "prompt",
      addEventListener: addEventListenerSpy,
      removeEventListener: vi.fn(),
    });

    renderHook(() => useGeolocation());

    await waitFor(() => {
      expect(addEventListenerSpy).toHaveBeenCalledWith("change", expect.any(Function));
    });
  });

  it("re-fetches location when permission changes from prompt to granted", async () => {
    // Create a mock PermissionStatus with a LIVE mutable state property
    // (the browser API updates the SAME object and fires the change event)
    const mockStatus = {
      _state: "prompt",
      get state() {
        return this._state;
      },
      set state(val) {
        this._state = val;
      },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    // Capture when the handler is registered
    let capturedHandler = null;
    mockStatus.addEventListener = vi.fn((event, handler) => {
      capturedHandler = handler;
    });

    global.navigator.permissions.query = vi.fn().mockResolvedValue(mockStatus);

    const { result } = renderHook(() => useGeolocation());

    await waitFor(() => {
      expect(capturedHandler).not.toBeNull();
    });

    // Give the permission denied error (getCurrentPosition will fail)
    act(() => {
      errorCallback(createGeoError(1, "Permission denied"));
    });

    expect(result.current.permissionState).toBe("denied");

    // Now simulate permission change: update the live object's state and fire the handler
    act(() => {
      mockStatus._state = "granted";
      capturedHandler();
    });

    // refreshLocation should be called again (2nd call)
    expect(global.navigator.geolocation.getCurrentPosition).toHaveBeenCalledTimes(2);
  });
});

// ============================================================
// SUCCESSFUL POSITION ACQUISITION
// ============================================================
describe("successful position acquisition", () => {
  it("sets position, grants permission, clears loading and error", () => {
    const { result } = renderHook(() => useGeolocation());

    // Initially loading
    expect(result.current.loading).toBe(true);
    expect(result.current.position).toBeNull();

    act(() => {
      successCallback(mockPosition(14.5995, 120.9842));
    });

    expect(result.current.position).toEqual({ lat: 14.5995, lng: 120.9842 });
    expect(result.current.permissionState).toBe("granted");
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("calls getCurrentPosition with high accuracy options", () => {
    renderHook(() => useGeolocation());

    expect(global.navigator.geolocation.getCurrentPosition).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  });
});

// ============================================================
// ERROR HANDLING
// ============================================================
describe("error handling", () => {
  it("handles PERMISSION_DENIED (code 1)", () => {
    const { result } = renderHook(() => useGeolocation());

    act(() => {
      errorCallback(createGeoError(1, "User denied Geolocation"));
    });

    expect(result.current.permissionState).toBe("denied");
    expect(result.current.error).toContain("denied");
    expect(result.current.position).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("handles POSITION_UNAVAILABLE (code 2)", () => {
    const { result } = renderHook(() => useGeolocation());

    act(() => {
      errorCallback(createGeoError(2, "Position unavailable"));
    });

    expect(result.current.error).toContain("could not be determined");
    expect(result.current.permissionState).toBe("prompt");
    expect(result.current.position).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("handles TIMEOUT (code 3)", () => {
    const { result } = renderHook(() => useGeolocation());

    act(() => {
      errorCallback(createGeoError(3, "Timeout"));
    });

    expect(result.current.error).toContain("timed out");
    expect(result.current.position).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("handles unknown error codes gracefully", () => {
    const { result } = renderHook(() => useGeolocation());

    act(() => {
      errorCallback(createGeoError(999, "Something weird happened"));
    });

    expect(result.current.error).toContain("unknown error");
    expect(result.current.position).toBeNull();
    expect(result.current.loading).toBe(false);
  });
});

// ============================================================
// REFRESH LOCATION
// ============================================================
describe("refreshLocation", () => {
  it("re-calls getCurrentPosition and resets state", () => {
    const { result } = renderHook(() => useGeolocation());

    // First, get a successful position
    act(() => {
      successCallback(mockPosition(14.5995, 120.9842));
    });

    expect(result.current.position).toEqual({ lat: 14.5995, lng: 120.9842 });

    // Now call refreshLocation
    act(() => {
      result.current.refreshLocation();
    });

    // Should be loading again
    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBeNull();

    // getCurrentPosition should have been called twice (initial + refresh)
    expect(global.navigator.geolocation.getCurrentPosition).toHaveBeenCalledTimes(2);

    // Simulate new position
    act(() => {
      successCallback(mockPosition(40.7128, -74.006));
    });

    expect(result.current.position).toEqual({ lat: 40.7128, lng: -74.006 });
    expect(result.current.loading).toBe(false);
  });

  it("handles geolocation becoming unavailable between renders", () => {
    const { result } = renderHook(() => useGeolocation());

    // Remove geolocation
    Object.defineProperty(global.navigator, "geolocation", {
      value: undefined,
      configurable: true,
    });

    act(() => {
      result.current.refreshLocation();
    });

    expect(result.current.permissionState).toBe("unavailable");
    expect(result.current.error).toBe("Geolocation is not supported by this browser.");
  });
});

// ============================================================
// INITIAL STATE
// ============================================================
describe("initial state", () => {
  it("starts with loading true and position null", () => {
    const { result } = renderHook(() => useGeolocation());

    expect(result.current.position).toBeNull();
    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBeNull();
    expect(result.current.permissionState).toBe("prompt");
    expect(typeof result.current.refreshLocation).toBe("function");
  });
});

// ============================================================
// CLEANUP
// ============================================================
describe("cleanup", () => {
  it("resolves the geolocation request and unmounts without error", async () => {
    const { result, unmount } = renderHook(() => useGeolocation());

    // Resolve the initial geolocation request
    await act(async () => {
      successCallback(mockPosition());
    });

    expect(result.current.position).toEqual({ lat: 14.5995, lng: 120.9842 });
    expect(() => unmount()).not.toThrow();
  });
});

// ============================================================
// EDGE CASES
// ============================================================
describe("edge cases", () => {
  it("handles permissions.query() rejection gracefully", async () => {
    global.navigator.permissions.query = vi.fn().mockRejectedValue(new Error("Permissions API unavailable"));

    const { result } = renderHook(() => useGeolocation());

    // Should fall through and still call getCurrentPosition
    expect(global.navigator.geolocation.getCurrentPosition).toHaveBeenCalled();

    // Resolve the position
    await act(async () => {
      successCallback(mockPosition());
    });

    expect(result.current.position).toEqual({ lat: 14.5995, lng: 120.9842 });
    expect(result.current.permissionState).toBe("granted");
  });
});
