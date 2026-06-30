import { describe, it, expect } from "vitest";
import {
  getUserId,
  userCanAccessTask,
  canUserDeleteTask,
} from "@/lib/task-access";

describe("getUserId", () => {
  it("returns null for null/undefined", () => {
    expect(getUserId(null)).toBeNull();
    expect(getUserId(undefined)).toBeNull();
  });

  it("returns the string when passed a string", () => {
    expect(getUserId("user_123")).toBe("user_123");
  });

  it("extracts userId from an object", () => {
    expect(getUserId({ userId: "u1" })).toBe("u1");
    expect(getUserId({ id: "u2" })).toBe("u2");
    expect(getUserId({ _id: "u3" })).toBe("u3");
  });
});

describe("userCanAccessTask", () => {
  it("returns false for null inputs", () => {
    expect(userCanAccessTask(null, {})).toBe(false);
    expect(userCanAccessTask("u1", null)).toBe(false);
  });

  it("returns true if user is directly assigned", () => {
    const task = { assigned_to: ["u1", "u2"], workspace_id: "ws_1" };
    expect(userCanAccessTask("u1", task, [])).toBe(true);
    expect(userCanAccessTask("u3", task, [])).toBe(false);
  });

  it("returns true for owners and admins", () => {
    const task = { workspace_id: "ws_1" };
    const memberships = [
      { user_id: "u1", workspace_id: "ws_1", role: "owner" },
    ];
    expect(userCanAccessTask("u1", task, memberships)).toBe(true);
  });

  it("returns true if user shares a team with the task", () => {
    const task = { workspace_id: "ws_1", team_id: "team_1" };
    const memberships = [
      {
        user_id: "u1",
        workspace_id: "ws_1",
        role: "member",
        team_ids: ["team_1"],
      },
    ];
    expect(userCanAccessTask("u1", task, memberships)).toBe(true);
  });

  it("returns false if user is in workspace but not in the task's team", () => {
    const task = { workspace_id: "ws_1", team_id: "team_2" };
    const memberships = [
      {
        user_id: "u1",
        workspace_id: "ws_1",
        role: "member",
        team_ids: ["team_1"],
      },
    ];
    expect(userCanAccessTask("u1", task, memberships)).toBe(false);
  });

  it("returns false if no membership matches", () => {
    const task = { workspace_id: "ws_1" };
    expect(userCanAccessTask("u1", task, [])).toBe(false);
  });
});

describe("canUserDeleteTask", () => {
  const task = {
    _id: "task_1",
    workspace_id: "ws_1",
    created_by: "creator_u1",
  };

  it("returns false for null inputs", () => {
    expect(canUserDeleteTask({ userId: null, task })).toBe(false);
    expect(canUserDeleteTask({ userId: "u1", task: null })).toBe(false);
  });

  it("returns true if user has full access", () => {
    expect(
      canUserDeleteTask({
        userId: "u1",
        task,
        hasFullAccess: true,
      })
    ).toBe(true);
  });

  it("returns true if user is the task creator", () => {
    expect(
      canUserDeleteTask({
        userId: "creator_u1",
        task,
      })
    ).toBe(true);
  });

  it("returns false for a non-creator member without full access", () => {
    expect(
      canUserDeleteTask({
        userId: "some_other_u2",
        task,
        memberships: [],
        hasFullAccess: false,
      })
    ).toBe(false);
  });

  it("returns true for an admin or owner in the workspace", () => {
    const memberships = [
      { user_id: "admin_u2", workspace_id: "ws_1", role: "admin" },
    ];
    expect(
      canUserDeleteTask({
        userId: "admin_u2",
        task,
        memberships,
      })
    ).toBe(true);
  });
});
