import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import { getDB } from "@/db/couch";
import TaskCard from "@/components/TaskCard";

// Helper to build a minimal task
const buildTask = (overrides = {}) => ({
  _id: "task_1",
  title: "Test Task",
  description: "A description",
  status: "upcoming",
  priority: "medium",
  workspace_id: "ws_1",
  team_id: null,
  assigned_to: [],
  due_date: null,
  start_date: null,
  end_date: null,
  location_name: null,
  created_by: "user_1",
  recurring_interval: null,
  ...overrides,
});

describe("TaskCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the task title", () => {
    render(<TaskCard task={buildTask()} members={[]} />);
    expect(screen.getByText("Test Task")).toBeInTheDocument();
  });

  it("renders the task description", () => {
    render(<TaskCard task={buildTask()} members={[]} />);
    expect(screen.getByText("A description")).toBeInTheDocument();
  });

  it("shows correct priority badge for high priority", () => {
    render(<TaskCard task={buildTask({ priority: "high" })} members={[]} />);
    expect(screen.getByText("High")).toBeInTheDocument();
  });

  it("shows correct priority badge for medium priority", () => {
    render(<TaskCard task={buildTask({ priority: "medium" })} members={[]} />);
    expect(screen.getByText("Medium")).toBeInTheDocument();
  });

  it("shows correct priority badge for low priority", () => {
    render(<TaskCard task={buildTask({ priority: "low" })} members={[]} />);
    expect(screen.getByText("Low")).toBeInTheDocument();
  });

  it("renders the correct status badge", () => {
    render(<TaskCard task={buildTask({ status: "today" })} members={[]} />);
    expect(screen.getByText("Today")).toBeInTheDocument();
  });

  it('shows "Upcoming" status badge by default', () => {
    render(<TaskCard task={buildTask()} members={[]} />);
    expect(screen.getByText("Upcoming")).toBeInTheDocument();
  });

  it("calls onClick when the card is clicked", () => {
    const onClick = vi.fn();
    const task = buildTask();
    render(<TaskCard task={task} members={[]} onClick={onClick} />);
    fireEvent.click(screen.getByText("Test Task").closest("div"));
    expect(onClick).toHaveBeenCalledWith(task);
  });

  it("renders a complete button for non-completed tasks", () => {
    render(<TaskCard task={buildTask({ status: "today" })} members={[]} />);
    const completeBtn = screen.getByTitle("Mark this occurrence done");
    expect(completeBtn).toBeInTheDocument();
  });

  it("hides complete button for completed tasks", () => {
    render(<TaskCard task={buildTask({ status: "completed" })} members={[]} />);
    expect(screen.queryByTitle("Mark this occurrence done")).not.toBeInTheDocument();
  });

  it("dispatches events when completing a task", async () => {
    // Spy on window.dispatchEvent
    const dispatchEventSpy = vi.spyOn(window, "dispatchEvent");

    render(<TaskCard task={buildTask({ status: "today" })} members={[]} />);
    const completeBtn = screen.getByTitle("Mark this occurrence done");
    fireEvent.click(completeBtn);

    // Wait for async handler to complete and dispatch events
    await waitFor(() => {
      expect(dispatchEventSpy).toHaveBeenCalled();
    });

    expect(getDB).toHaveBeenCalledWith("user_1");

    // Should have dispatched route:changed and notifications:changed events
    const eventTypes = dispatchEventSpy.mock.calls.map(([e]) => e.type);
    expect(eventTypes).toContain("notifications:changed");
    expect(eventTypes).toContain("route:changed");
  });

  it("renders assigned members as avatar initials", () => {
    const members = [
      { id: "m1", full_name: "Alice Smith" },
      { id: "m2", full_name: "Bob Jones" },
    ];
    render(<TaskCard task={buildTask({ assigned_to: ["m1", "m2"] })} members={members} />);
    expect(screen.getByText("A")).toBeInTheDocument(); // Alice
    expect(screen.getByText("B")).toBeInTheDocument(); // Bob
  });

  it("shows +N overflow for more than 3 assigned members", () => {
    const members = [
      { id: "m1", full_name: "A" },
      { id: "m2", full_name: "B" },
      { id: "m3", full_name: "C" },
      { id: "m4", full_name: "D" },
    ];
    render(<TaskCard task={buildTask({ assigned_to: ["m1", "m2", "m3", "m4"] })} members={members} />);
    expect(screen.getByText("+1")).toBeInTheDocument();
  });

  it("shows location name when present", () => {
    render(
      <TaskCard
        task={buildTask({ location_name: "Manila, Philippines" })}
        members={[]}
      />
    );
    expect(screen.getByText("Manila, Philippines")).toBeInTheDocument();
  });

  it("strikethroughs the title for completed tasks", () => {
    render(<TaskCard task={buildTask({ status: "completed" })} members={[]} />);
    const title = screen.getByText("Test Task");
    expect(title.className).toContain("line-through");
  });

  it("shows recurring icon and label for recurring tasks", () => {
    const task = buildTask({
      status: "recurring",
      recurring_interval: "weekly",
      recurring_interval_count: 1,
      due_date: "2025-06-22T10:00:00",
    });
    render(<TaskCard task={task} members={[]} />);
    expect(screen.getByText(/Every week/i)).toBeInTheDocument();
  });

  it("shows reopen button for completed recurring tasks", () => {
    const onReopen = vi.fn();
    const task = buildTask({
      status: "completed",
      recurring_interval: "weekly",
    });
    render(<TaskCard task={task} members={[]} onReopen={onReopen} />);
    const reopenBtn = screen.getByText("Reopen");
    expect(reopenBtn).toBeInTheDocument();

    fireEvent.click(reopenBtn);
    expect(onReopen).toHaveBeenCalledWith(task);
  });

  it("renders without crashing when no members are provided", () => {
    render(<TaskCard task={buildTask({ assigned_to: ["m1"] })} />);
    expect(screen.getByText("Test Task")).toBeInTheDocument();
  });
});
