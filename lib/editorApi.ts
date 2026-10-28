/**
 * The editor app's one door to the backend. Every path is under
 * /api/editor, every body is JSON both ways, and the session cookie is the
 * only credential - nothing here ever holds a token.
 */
export class EditorApiError extends Error {
  constructor(
    public status: number,
    message: string,
    /** The rest of the error body, e.g. a 507's `needed` and `free` bytes. */
    public data: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "EditorApiError";
  }
}

/**
 * Throws EditorApiError carrying the server's own `error` text, because
 * those sentences ("Only the streamer can do this.", "Type the name exactly
 * to confirm") are written to be shown as they are.
 *
 * A 401 means the session expired mid-use: the browser goes to login with
 * the hash kept, so it comes back to the same tape rather than to the
 * projects list. It still throws, so the caller stops what it was doing.
 */
export async function editorApi<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(`/api/editor${path}`, {
    method: init.method ?? "GET",
    credentials: "same-origin",
    ...(init.body !== undefined && {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(init.body),
    }),
  });
  if (res.status === 401) {
    window.location.assign("/auth/login?next=" + encodeURIComponent("/editor" + window.location.hash));
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new EditorApiError(res.status, data?.error || `Request failed (${res.status})`, data && typeof data === "object" ? data : {});
  }
  return data as T;
}

/**
 * Starts the browser download of a Drive file from Google's direct link.
 * A download navigation leaves the page where it is, and the bytes go
 * Google -> browser, never through the Mac Mini.
 */
export function driveDownload(fileId: string): void {
  window.location.assign(`https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download`);
}

/**
 * The VOD Download button: records the click server-side first (an
 * editor's click is what lets them delete the VOD), then downloads.
 * Returns the Drive page link the backend answers with.
 */
export async function downloadVod(projectId: number, fileId: string): Promise<string | null> {
  const link = await editorApi<{ drive_url: string | null }>(`/projects/${projectId}/download`, { method: "POST" });
  driveDownload(fileId);
  return link.drive_url;
}

/** A time position or duration: 03:42, or 1:03:42 past the hour. */
export function clock(s: number): string {
  const t = Math.floor(s);
  const mmss = `${String(Math.floor((t % 3600) / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
  return t >= 3600 ? `${Math.floor(t / 3600)}:${mmss}` : mmss;
}
