/**
 * React binding to a ProjectStore via useSyncExternalStore. The hook owns the
 * subscription lifecycle (connect on mount, disconnect on unmount / project
 * change) and exposes the store's gate actions. All authoritative state still
 * flows from the backend stream (Spec 2.4–2.5).
 */
"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";

import { backendHttpBase } from "@/lib/config";
import { ProjectStore } from "@/lib/projectStore";
import { INITIAL_STORE_STATE, type StoreState } from "@/lib/types";

export interface ProjectStreamApi {
  state: StoreState;
  approve: () => Promise<void>;
  requestChanges: (direction: string) => Promise<void>;
  redirect: (direction: string) => Promise<void>;
}

export function useProjectStream(projectId: string | null): ProjectStreamApi {
  const store = useMemo(
    () =>
      projectId
        ? new ProjectStore({ projectId, httpBase: backendHttpBase() })
        : null,
    [projectId],
  );

  useEffect(() => {
    if (!store) return;
    store.connect();
    return () => store.disconnect();
  }, [store]);

  const subscribe = useMemo(
    () => (cb: () => void) => (store ? store.subscribe(() => cb()) : () => {}),
    [store],
  );
  const getSnapshot = useMemo(
    () => () => (store ? store.getState() : INITIAL_STORE_STATE),
    [store],
  );

  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return {
    state,
    approve: () => (store ? store.approve() : Promise.resolve()),
    requestChanges: (direction: string) =>
      store ? store.requestChanges(direction) : Promise.resolve(),
    redirect: (direction: string) =>
      store ? store.redirect(direction) : Promise.resolve(),
  };
}
