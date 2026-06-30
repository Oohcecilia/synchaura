import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import useRoute from "../useRoute";

// Mock apiRequest — use vi.hoisted so the variable is available before the hoisted vi.mock
const mockApiRequest = vi.hoisted(() => vi.fn());
vi.mock("@/api/client", () => ({
  apiRequest: mockApiRequest,
}));

/**
 * Factory for a successful API response.
 */
function successResponse(overrides = {}) {
  return {
    route: {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: [
              [120.9842, 14.5995],
              [121.007, 14.601],
              [121.02, 14.61],
            ],
          },
          properties: {
            segments: [
              {
                distance: 5230,
                duration: 480,
              },
            ],
          },
        },
      ],
    },
    summary: {
      distance: 5230,
      duration: 480,
    },
    ...overrides,
  };
}

/**
 * Creates an error-like object matching what apiRequest throws on failure.
 */
function apiError(detail) {
  const err = new Error(detail);
  err.detail = detail;
  return err;
}

beforeEach(() => {
  mockApiRequest.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ============================================================
// INITIAL STATE
// ============================================================
describe("initial state", () => {
  it("starts with defaults: null route, not loading, no error", () => {
    const { result } = renderHook(() => useRoute());

    expect(result.current.route).toBeNull();
    expect(result.current.distance).toBeNull();
    expect(result.current.duration).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(typeof result.current.fetchRoute).toBe("function");
    expect(typeof result.current.clearRoute).toBe("function");
  });
});

// ============================================================
// SUCCESSFUL ROUTE FETCH
// ============================================================
describe("successful route fetch", () => {
  it("sets route, distance, duration and clears loading on success", async () => {
    mockApiRequest.mockResolvedValue(successResponse());

    const { result } = renderHook(() => useRoute());

    await act(async () => {
      await result.current.fetchRoute(
        { lat: 14.5995, lng: 120.9842 },
        { lat: 14.61, lng: 121.02 }
      );
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.route).toEqual(
      expect.objectContaining({ type: "FeatureCollection" })
    );
    expect(result.current.distance).toBe(5230);
    expect(result.current.duration).toBe(480);
  });

  it("calls apiRequest with the correct endpoint and body", async () => {
    mockApiRequest.mockResolvedValue(successResponse());

    const { result } = renderHook(() => useRoute());

    await act(async () => {
      await result.current.fetchRoute(
        { lat: 14.5995, lng: 120.9842 },
        { lat: 14.61, lng: 121.02 }
      );
    });

    expect(mockApiRequest).toHaveBeenCalledWith("/routing", {
      method: "POST",
      body: {
        origin_lat: 14.5995,
        origin_lng: 120.9842,
        dest_lat: 14.61,
        dest_lng: 121.02,
        profile: "driving-car",
      },
    });
  });

  it("handles null summary fields gracefully", async () => {
    mockApiRequest.mockResolvedValue({
      route: successResponse().route,
      summary: {},
    });

    const { result } = renderHook(() => useRoute());

    await act(async () => {
      await result.current.fetchRoute(
        { lat: 14.5995, lng: 120.9842 },
        { lat: 14.61, lng: 121.02 }
      );
    });

    expect(result.current.distance).toBeNull();
    expect(result.current.duration).toBeNull();
    expect(result.current.route).toBeDefined();
  });

  it("handles completely empty response", async () => {
    mockApiRequest.mockResolvedValue({});

    const { result } = renderHook(() => useRoute());

    await act(async () => {
      await result.current.fetchRoute(
        { lat: 14.5995, lng: 120.9842 },
        { lat: 14.61, lng: 121.02 }
      );
    });

    expect(result.current.route).toBeUndefined();
    expect(result.current.distance).toBeNull();
    expect(result.current.duration).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });
});

// ============================================================
// ERROR HANDLING
// ============================================================
describe("error handling", () => {
  it("sets error when apiRequest throws", async () => {
    mockApiRequest.mockRejectedValue(apiError("Routing service unavailable"));

    const { result } = renderHook(() => useRoute());

    await act(async () => {
      await result.current.fetchRoute(
        { lat: 14.5995, lng: 120.9842 },
        { lat: 14.61, lng: 121.02 }
      );
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toContain("Routing service unavailable");
    expect(result.current.route).toBeNull();
  });

  it("falls back to err.message when err.detail is missing", async () => {
    mockApiRequest.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useRoute());

    await act(async () => {
      await result.current.fetchRoute(
        { lat: 14.5995, lng: 120.9842 },
        { lat: 14.61, lng: 121.02 }
      );
    });

    expect(result.current.error).toContain("Network error");
  });

  it("uses fallback message when neither detail nor message exist", async () => {
    // An error-like object with no detail or message
    const emptyErr = {};
    mockApiRequest.mockRejectedValue(emptyErr);

    const { result } = renderHook(() => useRoute());

    await act(async () => {
      await result.current.fetchRoute(
        { lat: 14.5995, lng: 120.9842 },
        { lat: 14.61, lng: 121.02 }
      );
    });

    expect(result.current.error).toBe("Failed to fetch route");
  });
});

// ============================================================
// REQUEST DEDUPLICATION
// ============================================================
describe("request deduplication", () => {
  it("ignores stale responses when fetchRoute is called rapidly", async () => {
    // Create deferred promises so we can control resolution order.
    // mockResolvedValueOnce returns Promise.resolve(promise), which follows
    // the inner promise's state — so awaiting apiRequest() ultimately awaits
    // our deferred promise.
    let resolveA, resolveB;
    const promiseA = new Promise((resolve) => { resolveA = resolve; });
    const promiseB = new Promise((resolve) => { resolveB = resolve; });

    mockApiRequest
      .mockResolvedValueOnce(promiseA)
      .mockResolvedValueOnce(promiseB);

    const { result } = renderHook(() => useRoute());

    // Start two rapid fetches
    act(() => {
      result.current.fetchRoute(
        { lat: 14.0, lng: 121.0 },
        { lat: 14.5, lng: 121.5 }
      );
    });
    act(() => {
      result.current.fetchRoute(
        { lat: 15.0, lng: 122.0 },
        { lat: 15.5, lng: 122.5 }
      );
    });

    // Resolve the first (stale) request first
    await act(async () => {
      resolveA(successResponse());
    });

    // The stale response should be ignored — still loading from B
    expect(result.current.loading).toBe(true);
    expect(result.current.route).toBeNull();
    expect(result.current.error).toBeNull();

    // Now resolve the second (current) request
    await act(async () => {
      resolveB(successResponse());
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.distance).toBe(5230);
    expect(result.current.duration).toBe(480);
    expect(result.current.error).toBeNull();
  });

  it("ignores stale errors from previous requests", async () => {
    let resolveA, rejectB;
    const promiseA = new Promise((resolve) => { resolveA = resolve; });
    const promiseB = new Promise((_, reject) => { rejectB = reject; });

    mockApiRequest
      .mockResolvedValueOnce(promiseA)
      .mockResolvedValueOnce(promiseB);

    const { result } = renderHook(() => useRoute());

    // Start two rapid fetches
    act(() => {
      result.current.fetchRoute({ lat: 1, lng: 1 }, { lat: 2, lng: 2 });
    });
    act(() => {
      result.current.fetchRoute({ lat: 3, lng: 3 }, { lat: 4, lng: 4 });
    });

    // Second request rejects first (stale error)
    await act(async () => {
      rejectB(apiError("Second failed"));
    });

    // Since B is the current request, this error should be shown
    expect(result.current.error).toContain("Second failed");
    expect(result.current.loading).toBe(false);

    // Now resolve the first (stale) request — should be ignored
    await act(async () => {
      resolveA(successResponse({ distance: 1000 }));
    });

    // State should remain unchanged (error from B)
    expect(result.current.error).toContain("Second failed");
    expect(result.current.route).toBeNull();
  });
});

// ============================================================
// CLEAR ROUTE
// ============================================================
describe("clearRoute", () => {
  it("resets all state back to defaults", async () => {
    mockApiRequest.mockResolvedValue(successResponse());

    const { result } = renderHook(() => useRoute());

    // First fetch a route
    await act(async () => {
      await result.current.fetchRoute(
        { lat: 14.5995, lng: 120.9842 },
        { lat: 14.61, lng: 121.02 }
      );
    });

    expect(result.current.distance).toBe(5230);
    expect(result.current.loading).toBe(false);

    // Now clear
    act(() => {
      result.current.clearRoute();
    });

    expect(result.current.route).toBeNull();
    expect(result.current.distance).toBeNull();
    expect(result.current.duration).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });
});

// ============================================================
// EDGE CASES
// ============================================================
describe("edge cases", () => {
  it("calls clearRoute when fetchRoute is called with null origin", async () => {
    const { result } = renderHook(() => useRoute());

    // Set some state first
    mockApiRequest.mockResolvedValue(successResponse());
    await act(async () => {
      await result.current.fetchRoute({ lat: 1, lng: 1 }, { lat: 2, lng: 2 });
    });
    expect(result.current.distance).toBe(5230);

    // Now call with null origin
    await act(async () => {
      await result.current.fetchRoute(null, { lat: 2, lng: 2 });
    });

    // Should have been cleared
    expect(result.current.route).toBeNull();
    expect(result.current.distance).toBeNull();
  });

  it("calls clearRoute when fetchRoute is called with null dest", async () => {
    const { result } = renderHook(() => useRoute());

    mockApiRequest.mockResolvedValue(successResponse());
    await act(async () => {
      await result.current.fetchRoute({ lat: 1, lng: 1 }, { lat: 2, lng: 2 });
    });
    expect(result.current.distance).toBe(5230);

    await act(async () => {
      await result.current.fetchRoute({ lat: 1, lng: 1 }, null);
    });

    expect(result.current.route).toBeNull();
  });
});
