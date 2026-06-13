import { describe, expect, test } from "vitest";

import { applyServerSnapshot, isProjectSnapshot } from "@/lib/snapshot";
import type { ProjectSnapshot } from "@/lib/types";

const VALID: ProjectSnapshot = {
  project_id: "p1",
  phase: "planning",
  status: "awaiting_approval",
  awaiting_gate: "planning",
  gate_approvals: { initiation: true },
  messages: ["Project p1 entered planning"],
  last_rejection: null,
  updated_at: "2026-06-09T00:00:00+00:00",
};

describe("isProjectSnapshot", () => {
  test("accepts a well-formed snapshot", () => {
    expect(isProjectSnapshot(VALID)).toBe(true);
  });

  test("rejects an unknown status", () => {
    expect(isProjectSnapshot({ ...VALID, status: "bogus" })).toBe(false);
  });

  test("rejects non-objects and malformed fields", () => {
    expect(isProjectSnapshot(null)).toBe(false);
    expect(isProjectSnapshot("nope")).toBe(false);
    expect(isProjectSnapshot({ ...VALID, messages: "x" })).toBe(false);
    expect(isProjectSnapshot({ ...VALID, gate_approvals: [] })).toBe(false);
  });
});

describe("applyServerSnapshot — single source of truth", () => {
  test("a valid frame fully replaces the current state", () => {
    expect(applyServerSnapshot(null, VALID)).toEqual(VALID);
  });

  test("a malformed frame is ignored, preserving the last good state", () => {
    expect(applyServerSnapshot(VALID, { garbage: true })).toBe(VALID);
  });

  test("replaces rather than merges", () => {
    const incoming: ProjectSnapshot = {
      ...VALID,
      phase: "team_assembly",
      gate_approvals: { initiation: true, planning: true },
    };
    const next = applyServerSnapshot(VALID, incoming);
    expect(next).toEqual(incoming);
    expect(next).not.toBe(VALID);
  });
});
