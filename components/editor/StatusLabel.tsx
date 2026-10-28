"use client";

import type { TapeStatus } from "@/lib/useProject";

export const STATUS_LABELS: Record<TapeStatus, string> = {
  cutting: "Cutting",
  in_review: "In review",
  changes_asked: "Changes asked",
  final: "Final",
};

const TONE: Record<TapeStatus, string> = {
  cutting: "border-seam text-dim",
  in_review: "border-field text-field",
  changes_asked: "border-amber text-amber",
  final: "border-signal text-signal",
};

export function StatusLabel({ status }: { status: TapeStatus }) {
  return <span className={`label border px-2 py-0.5 text-[11px] ${TONE[status]}`}>{STATUS_LABELS[status]}</span>;
}

export const finalPrompt = (name: string) => `Mark ${name} Final? You'll download it, then its files are deleted.`;

/**
 * A tape's status picker. The editor never gets `final` to choose and
 * cannot move a tape out of it, so a Final tape is only a label for them;
 * the streamer marks Final through a confirm, because Final is what starts
 * the download-then-delete. The server refuses the same moves regardless.
 */
export function StatusSelect({
  name,
  status,
  role,
  onChange,
  disabled,
}: {
  name: string;
  status: TapeStatus;
  role: "admin" | "editor";
  onChange: (status: TapeStatus) => void;
  disabled?: boolean;
}) {
  if (role !== "admin" && status === "final") return <StatusLabel status={status} />;
  const options = (Object.keys(STATUS_LABELS) as TapeStatus[]).filter((s) => role === "admin" || s !== "final");
  return (
    <select
      aria-label="Status"
      value={status}
      disabled={disabled}
      onChange={(e) => {
        const next = e.target.value as TapeStatus;
        if (next === "final" && !window.confirm(finalPrompt(name))) return;
        onChange(next);
      }}
      className="border border-seam bg-ink px-2 py-1.5 text-sm text-phosphor disabled:opacity-40"
    >
      {options.map((s) => (
        <option key={s} value={s}>
          {STATUS_LABELS[s]}
        </option>
      ))}
    </select>
  );
}
