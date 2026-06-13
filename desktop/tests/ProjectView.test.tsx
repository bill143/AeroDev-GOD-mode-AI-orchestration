// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { ProjectView } from "@/components/ProjectView";
import type { ProjectSnapshot, StoreState } from "@/lib/types";

afterEach(cleanup);

function snap(over: Partial<ProjectSnapshot> = {}): ProjectSnapshot {
  return {
    project_id: "p1",
    phase: "planning",
    status: "awaiting_approval",
    awaiting_gate: "planning",
    gate_approvals: { initiation: true },
    messages: ["Project p1 entered planning"],
    last_rejection: null,
    updated_at: "2026-06-09T00:00:00+00:00",
    ...over,
  };
}

function state(over: Partial<StoreState> = {}): StoreState {
  return {
    snapshot: snap(),
    connection: "open",
    error: null,
    pendingAction: false,
    ...over,
  };
}

const noop = () => {};

describe("ProjectView — single source of truth, rendered", () => {
  test("renders the open gate and highlights the live phase from the snapshot", () => {
    const { container } = render(
      <ProjectView
        state={state()}
        onApprove={noop}
        onRequestChanges={noop}
        onRedirect={noop}
      />,
    );
    expect(screen.getByTestId("gate-card").getAttribute("data-gate")).toBe(
      "planning",
    );
    expect(screen.getByTestId("approve")).toBeTruthy();
    const row = container.querySelector('li[data-phase="planning"]');
    expect(row?.getAttribute("data-current")).toBe("true");
  });

  test("Approve invokes the approve callback (action, not local state change)", () => {
    const onApprove = vi.fn();
    render(
      <ProjectView
        state={state()}
        onApprove={onApprove}
        onRequestChanges={noop}
        onRedirect={noop}
      />,
    );
    fireEvent.click(screen.getByTestId("approve"));
    expect(onApprove).toHaveBeenCalledOnce();
  });

  test("Request Changes sends the typed direction (Spec 1.6 rework loop)", () => {
    const onRequestChanges = vi.fn();
    render(
      <ProjectView
        state={state()}
        onApprove={noop}
        onRequestChanges={onRequestChanges}
        onRedirect={noop}
      />,
    );
    fireEvent.click(screen.getByTestId("request-changes"));
    fireEvent.change(screen.getByTestId("direction-input"), {
      target: { value: "tighten scope" },
    });
    fireEvent.click(screen.getByTestId("direction-submit"));
    expect(onRequestChanges).toHaveBeenCalledWith("tighten scope");
  });

  test("a rejected gate shows the last rejection and is still approvable", () => {
    render(
      <ProjectView
        state={state({
          snapshot: snap({ status: "rejected", last_rejection: "tighten scope" }),
        })}
        onApprove={noop}
        onRequestChanges={noop}
        onRedirect={noop}
      />,
    );
    expect(screen.getByTestId("last-rejection").textContent).toContain(
      "tighten scope",
    );
    expect(screen.getByTestId("approve")).toBeTruthy();
  });

  test("a complete project shows no open gate and no Approve control", () => {
    render(
      <ProjectView
        state={state({
          snapshot: snap({
            phase: "complete",
            status: "complete",
            awaiting_gate: null,
            gate_approvals: {
              initiation: true,
              planning: true,
              team_assembly: true,
            },
          }),
        })}
        onApprove={noop}
        onRequestChanges={noop}
        onRedirect={noop}
      />,
    );
    expect(screen.getByTestId("gate-card").getAttribute("data-gate")).toBe(
      "none",
    );
    expect(screen.queryByTestId("approve")).toBeNull();
  });

  test("focus=feed renders only the live feed (pop-out view)", () => {
    render(
      <ProjectView
        state={state()}
        focus="feed"
        onApprove={noop}
        onRequestChanges={noop}
        onRedirect={noop}
      />,
    );
    expect(screen.getByTestId("project-view").getAttribute("data-focus")).toBe(
      "feed",
    );
    expect(screen.getByTestId("feed-panel")).toBeTruthy();
    expect(screen.queryByTestId("gate-card")).toBeNull();
  });
});
