/**
 * Reconnection policy (pure, unit-tested). Spec 2.8: on connection loss the app
 * shows a clear "reconnecting" state and resumes from the last checkpoint on
 * reconnect. The backend re-sends the current snapshot on every (re)subscribe,
 * so reconnecting alone restores correct live state — no client replay needed.
 */

export const BASE_BACKOFF_MS = 500;
export const MAX_BACKOFF_MS = 15_000;

/** WebSocket close code the backend uses when the project does not exist. */
export const CLOSE_NOT_FOUND = 4404;
/** Normal closure. */
export const CLOSE_NORMAL = 1000;

/**
 * Whether a dropped socket should be retried.
 * - intentional client close       -> no
 * - normal closure (1000)           -> no
 * - project-not-found (4404)        -> no (retrying cannot fix a missing project)
 * - anything else (network, 1006…)  -> yes
 */
export function shouldReconnect(closeCode: number, intentional: boolean): boolean {
  if (intentional) return false;
  if (closeCode === CLOSE_NORMAL) return false;
  if (closeCode === CLOSE_NOT_FOUND) return false;
  return true;
}

/** Capped exponential backoff. attempt is 1-based (first retry = attempt 1). */
export function backoffDelay(attempt: number): number {
  const safeAttempt = Math.max(1, Math.floor(attempt));
  const exp = BASE_BACKOFF_MS * 2 ** (safeAttempt - 1);
  return Math.min(exp, MAX_BACKOFF_MS);
}
