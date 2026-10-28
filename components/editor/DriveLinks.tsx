"use client";

import type { ReactNode } from "react";
import { driveDownloadUrl, driveViewUrl } from "@/lib/editorApi";

/**
 * A Download that is a real new-tab link to Google, so Google's "can't scan
 * for viruses" page for a large file opens beside /editor instead of
 * replacing it (and every upload running in it). `onClick` must not await
 * before the link opens. Disabled (a delete in its undo hour) it is a
 * disabled button, since a link cannot be.
 */
export function DownloadLink({
  fileId,
  disabled = false,
  onClick,
  className,
  children,
}: {
  fileId: string;
  disabled?: boolean;
  onClick?: () => void;
  className: string;
  children: ReactNode;
}) {
  if (disabled) {
    return (
      <button type="button" disabled className={className}>
        {children}
      </button>
    );
  }
  return (
    <a href={driveDownloadUrl(fileId)} target="_blank" rel="noopener noreferrer" onClick={onClick} className={className}>
      {children}
    </a>
  );
}

export function OpenInDrive({ fileId }: { fileId: string }) {
  return (
    <a href={driveViewUrl(fileId)} target="_blank" rel="noopener noreferrer" className="text-xs text-dim hover:text-phosphor">
      Open in Drive ↗
    </a>
  );
}
