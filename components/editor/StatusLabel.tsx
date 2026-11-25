"use client";

import type { EditStatus } from "@/lib/useProject";
import { useAsk } from "./AskDialog";

export const STATUS_LABELS: Record<EditStatus, string> = {
  cutting: "Cutting",
  in_review: "In review",
  changes_asked: "Changes asked",
  final: "Final",
};

const TONE: Record<EditStatus, string> = {
  cutting: "border-seam text-dim",
  in_review: "border-phosphor bg-phosphor text-ink",
  changes_asked: "border-amber text-amber",
  final: "border-signal bg-signal text-ink",
};

export function StatusLabel({ status }: { status: EditStatus }) {
  return <span className={`label inline-block -skew-x-6 border-2 px-2 py-0.5 text-[11px] ${TONE[status]}`}>{STATUS_LABELS[status]}</span>;
}

const FINAL_MESSAGE = "You'll download it, then its files are deleted.";

/**
 * An edit's status picker. The editor never gets `final` to choose and
 * cannot move an edit out of it, so a Final edit is only a label for them;
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
  status: EditStatus;
  role: "admin" | "editor";
  onChange: (status: EditStatus) => void;
  disabled?: boolean;
}) {
  const ask = useAsk();
  if (role !== "admin" && status === "final") return <StatusLabel status={status} />;
  const options = (Object.keys(STATUS_LABELS) as EditStatus[]).filter((s) => role === "admin" || s !== "final");
  return (
    <>
      <select
        aria-label="Status"
        value={status}
        disabled={disabled}
        onChange={async (e) => {
          const next = e.target.value as EditStatus;
          if (next === "final" && !(await ask.confirm({ title: `Mark ${name} Final?`, message: FINAL_MESSAGE, confirmLabel: "Mark Final" }))) return;
          onChange(next);
        }}
        className="border-2 border-seam bg-ink px-2 py-1.5 text-sm text-phosphor disabled:opacity-40"
      >
        {options.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      {ask.dialog}
    </>
  );
}
