import type { ConnectionState } from "@/lib/types";

const LABEL: Record<ConnectionState, string> = {
  idle: "Idle",
  connecting: "Connecting…",
  open: "Live",
  reconnecting: "Reconnecting…",
  not_found: "Not found",
  closed: "Disconnected",
};

const DOT: Record<ConnectionState, string> = {
  idle: "bg-muted",
  connecting: "bg-warn",
  open: "bg-ok",
  reconnecting: "bg-warn",
  not_found: "bg-bad",
  closed: "bg-bad",
};

export function ConnectionBadge({ connection }: { connection: ConnectionState }) {
  const animated =
    connection === "open" ||
    connection === "reconnecting" ||
    connection === "connecting";
  return (
    <span
      className="inline-flex items-center gap-2 text-xs text-muted"
      data-testid="connection-badge"
      data-connection={connection}
    >
      <span
        className={`h-2 w-2 rounded-full ${DOT[connection]} ${animated ? "animate-pulse" : ""}`}
      />
      {LABEL[connection]}
    </span>
  );
}
