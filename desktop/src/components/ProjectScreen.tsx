"use client";

import { useProjectStream } from "@/hooks/useProjectStream";
import { popOutWindow, type PopOutView } from "@/lib/tauriWindows";
import { ProjectView } from "./ProjectView";

/**
 * Container: binds one project's live stream to the presentational ProjectView
 * and wires gate actions + pop-out. The subscription (and thus the single
 * source of truth) lives in the store the hook owns; this component never holds
 * authoritative state of its own.
 */
export function ProjectScreen({
  projectId,
  focus = "main",
}: {
  projectId: string;
  focus?: PopOutView;
}) {
  const { state, approve, requestChanges, redirect } =
    useProjectStream(projectId);

  return (
    <ProjectView
      state={state}
      focus={focus}
      onApprove={() => void approve()}
      onRequestChanges={(direction) => void requestChanges(direction)}
      onRedirect={(direction) => void redirect(direction)}
      onPopOut={(view) => void popOutWindow(projectId, view)}
    />
  );
}
