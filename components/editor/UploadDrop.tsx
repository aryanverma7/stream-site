"use client";

import { useState } from "react";
import { startUpload } from "@/lib/useTransfers";

/**
 * A tape's drop zone for a new version (drag-drop or the picker, one file
 * at a time). Dropping a file that is stored as unfinished on this tape
 * resumes it instead of making another version. The upload itself runs in
 * the transfers store, so it carries on if this tape is left.
 *
 * `disabled` is true while a delete covering the tape is in its undo hour,
 * when the server would refuse the upload anyway.
 */
export function UploadDrop({
  tapeId,
  projectId,
  kind,
  disabled,
  onUploaded,
}: {
  tapeId: number;
  projectId: number;
  kind: "tape" | "reel";
  disabled: boolean;
  onUploaded: () => void;
}) {
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const take = (files: FileList | File[] | null) => {
    if (disabled || !files?.length) return;
    if (files.length > 1) return setError("One file at a time.");
    setError(null);
    void startUpload({ tapeId, projectId, kind }, files[0], onUploaded);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        take(e.dataTransfer.files);
      }}
      className={`space-y-1 border border-dashed p-4 text-sm focus-within:outline focus-within:outline-2 focus-within:outline-field ${
        over ? "border-field bg-bezel-2" : "border-seam bg-bezel"
      } ${disabled ? "opacity-40" : ""}`}
    >
      <label className={disabled ? "block text-dim" : "block cursor-pointer text-dim"}>
        Drop a new version here, or <span className="text-phosphor underline">choose a file</span>
        <input
          type="file"
          accept="video/*"
          disabled={disabled}
          onChange={(e) => {
            take(e.target.files);
            e.target.value = "";
          }}
          className="sr-only"
        />
      </label>
      {disabled && <p className="text-xs text-dim">Uploads are off while a delete is pending.</p>}
      {error && (
        <p role="alert" className="text-xs text-rec">
          {error}
        </p>
      )}
    </div>
  );
}
