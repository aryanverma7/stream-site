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
 * Google's direct download for a Drive file. It uses the person's own Google
 * sign-in, so it works while the Mac Mini is down, and the bytes go Google ->
 * browser. Very large files get Google's "can't scan for viruses" page first,
 * which is why it is always opened as a new-tab link, never navigated to.
 */
export const driveDownloadUrl = (fileId: string) =>
  `https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download`;

/** The file's Drive page. Built here, so no media-link (and its Drive-wide token) is fetched for it. */
export const driveViewUrl = (fileId: string) => `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/view`;

/**
 * Records a VOD or clip Download click (an editor's click is what lets them
 * delete it). Called inside the click and never awaited before the link
 * opens, so the click stays a user gesture; keepalive lets it outlive the
 * tab switch. Never rejects: the download goes ahead either way.
 */
export function recordDownload(projectId: number): Promise<unknown> {
  return fetch(`/api/editor/projects/${projectId}/download`, { method: "POST", credentials: "same-origin", keepalive: true }).catch(() => {});
}

/** A length: 3:42, or 1:02:05 past the hour. */
export function duration(s: number): string {
  const t = Math.floor(s);
  const m = Math.floor((t % 3600) / 60);
  const ss = String(t % 60).padStart(2, "0");
  return t >= 3600 ? `${Math.floor(t / 3600)}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** A time position or duration: 03:42, or 1:03:42 past the hour. */
export function clock(s: number): string {
  const t = Math.floor(s);
  const mmss = `${String(Math.floor((t % 3600) / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
  return t >= 3600 ? `${Math.floor(t / 3600)}:${mmss}` : mmss;
}
