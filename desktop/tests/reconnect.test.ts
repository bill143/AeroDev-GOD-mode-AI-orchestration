import { describe, expect, test } from "vitest";

import {
  backoffDelay,
  BASE_BACKOFF_MS,
  CLOSE_NORMAL,
  CLOSE_NOT_FOUND,
  MAX_BACKOFF_MS,
  shouldReconnect,
} from "@/lib/reconnect";

describe("shouldReconnect", () => {
  test("never reconnects after an intentional client close", () => {
    expect(shouldReconnect(1006, true)).toBe(false);
  });

  test("does not reconnect on a normal closure", () => {
    expect(shouldReconnect(CLOSE_NORMAL, false)).toBe(false);
  });

  test("does not reconnect when the project is missing (4404)", () => {
    expect(shouldReconnect(CLOSE_NOT_FOUND, false)).toBe(false);
  });

  test("reconnects on an abnormal / network drop", () => {
    expect(shouldReconnect(1006, false)).toBe(true);
    expect(shouldReconnect(1011, false)).toBe(true);
  });
});

describe("backoffDelay", () => {
  test("grows exponentially from the base", () => {
    expect(backoffDelay(1)).toBe(BASE_BACKOFF_MS);
    expect(backoffDelay(2)).toBe(BASE_BACKOFF_MS * 2);
    expect(backoffDelay(3)).toBe(BASE_BACKOFF_MS * 4);
  });

  test("caps at the maximum", () => {
    expect(backoffDelay(99)).toBe(MAX_BACKOFF_MS);
  });

  test("treats non-positive attempts as the first retry", () => {
    expect(backoffDelay(0)).toBe(BASE_BACKOFF_MS);
    expect(backoffDelay(-5)).toBe(BASE_BACKOFF_MS);
  });
});
