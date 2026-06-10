import type { ProjectSnapshot } from "@/lib/types";

/**
 * Live activity feed — the project's streamed messages. A focused pop-out of
 * this panel (Spec 2.5) subscribes to the same stream, so it stays in lockstep
 * with the docked copy.
 */
export function FeedPanel({ snapshot }: { snapshot: ProjectSnapshot | null }) {
  const messages = snapshot?.messages ?? [];
  return (
    <div
      className="flex h-full min-h-0 flex-col rounded-lg border border-border bg-panel-2"
      data-testid="feed-panel"
    >
      <div className="border-b border-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted">
        Live feed
      </div>
      <ul className="flex-1 overflow-auto p-3 text-sm">
        {messages.length === 0 ? (
          <li className="text-muted">No activity yet.</li>
        ) : (
          messages.map((message, index) => (
            <li
              key={index}
              className="border-b border-border/40 py-1.5 font-mono text-fg last:border-0"
            >
              {message}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
