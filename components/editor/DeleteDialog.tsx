"use client";

import { useEffect, useState } from "react";
import { editorApi } from "@/lib/editorApi";
import type { DeleteKind } from "@/lib/useDeletions";

/**
 * The one delete confirmation: type the exact name, then the backend
 * waits an hour with an Undo. `label` is what the backend compares
 * against (the VOD's file name, the tape's or project's name).
 *
 * Esc closes it and goes no further, so it never also zooms out of the
 * view behind it - caught on window in the capture phase, so it works
 * wherever focus is, even after a click on the backdrop.
 */
export function DeleteDialog({
  kind,
  targetId,
  label,
  title,
  onClose,
  onDone,
}: {
  kind: DeleteKind;
  targetId: number;
  label: string;
  title: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await editorApi("/deletions", { method: "POST", body: { kind, target_id: targetId, confirm: typed } });
      onDone();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-4">
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-title"
        onSubmit={(e) => {
          e.preventDefault();
          if (typed === label) submit();
        }}
        className="w-full max-w-md space-y-4 border border-rec bg-bezel p-5"
      >
        <h3 id="delete-title" className="stencil text-3xl text-phosphor">
          {title}
        </h3>
        <p className="text-sm text-dim">
          Permanent once the hour is up - it skips Drive&apos;s trash. Type{" "}
          <span className="font-mono text-phosphor">{label}</span> to confirm.
        </p>
        <input
          autoFocus
          aria-label="Type the name to confirm"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          className="w-full border border-seam bg-ink px-3 py-2 text-sm text-phosphor"
        />
        {error && (
          <p role="alert" className="text-sm text-rec">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="label border border-seam px-4 py-2 text-sm text-phosphor hover:border-field">
            Cancel
          </button>
          <button
            type="submit"
            disabled={typed !== label || busy}
            className="label border border-rec bg-rec px-4 py-2 text-sm text-ink disabled:opacity-40"
          >
            Delete in an hour
          </button>
        </div>
      </form>
    </div>
  );
}
