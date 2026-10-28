"use client";

import { useState } from "react";
import { minutesLeft, type DeleteRequest } from "@/lib/useDeletions";

/**
 * A delete in its undo hour, shown wherever its target is. The countdown
 * moves with the deletions poll (every 30 s), which is finer than a minute.
 */
export function PendingDelete({ request, onUndo }: { request: DeleteRequest; onUndo: (id: number) => Promise<void> }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const mins = minutesLeft(request.delete_at);
  return (
    <span role="status" className="inline-flex flex-wrap items-center gap-2 border border-rec px-2 py-1 text-xs text-rec">
      <span className="label">
        {request.status === "running" || mins === 0 ? "Deleting now" : `Deleting in ${mins} min`}
      </span>
      {request.status === "pending" && (
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            await onUndo(request.id).catch((e: Error) => setError(e.message));
            setBusy(false);
          }}
          className="label border border-rec px-2 py-0.5 text-phosphor hover:bg-rec hover:text-ink disabled:opacity-40"
        >
          Undo
        </button>
      )}
      {error && <span>{error}</span>}
    </span>
  );
}
