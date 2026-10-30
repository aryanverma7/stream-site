/**
 * The two servers the browser checks run against:
 *
 * - startBackend: serves the built site from out/ the way core/site_server.py
 *   does (exact path, then <path>.html, then <path>/index.html, never outside
 *   out/), with core/server.py's headers (Service-Worker-Allowed on the worker,
 *   PAGE_CSP on HTML, with the mock Drive origin in connect-src), and answers
 *   the /api/editor routes the review player uses with canned JSON. Everyone
 *   is signed in.
 * - startDrive: /drive/v3/files/<id>?alt=media with real Range support, the
 *   Bearer token required, and CORS like Google's.
 */
import { createReadStream, statSync } from "node:fs";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";

export const TOKEN = "fake-drive-token";

const listen = (server: Server) =>
  new Promise<number>((res) => server.listen(0, "127.0.0.1", () => res((server.address() as AddressInfo).port)));
const shut = (server: Server) =>
  new Promise<void>((res) => {
    server.closeAllConnections();
    server.close(() => res());
  });

export type DriveRequest = { id: string; start: number; end: number; status: number; auth: boolean };

export type Drive = {
  origin: string;
  url(id: string): string;
  log: DriveRequest[];
  /** Bytes per second each response is sent at; 0 is as fast as it can. */
  rate: number;
  close(): Promise<void>;
};

export async function startDrive(files: Record<string, string>): Promise<Drive> {
  const drive: Drive = {
    origin: "",
    url: (id) => `${drive.origin}/drive/v3/files/${id}?alt=media`,
    log: [],
    rate: 0,
    close: () => shut(server),
  };
  const server = createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin ?? "*");
    res.setHeader("Access-Control-Expose-Headers", "Content-Range, Content-Length, Accept-Ranges");
    res.setHeader("Vary", "Origin");
    if (req.method === "OPTIONS") {
      res.setHeader("Access-Control-Allow-Headers", "Authorization, Range");
      res.setHeader("Access-Control-Allow-Methods", "GET");
      return res.writeHead(204).end();
    }
    const url = new URL(req.url ?? "/", "http://x");
    const m = /^\/drive\/v3\/files\/([^/]+)$/.exec(url.pathname);
    const file = m && url.searchParams.get("alt") === "media" ? files[m[1]] : undefined;
    const auth = req.headers.authorization === `Bearer ${TOKEN}`;
    const size = file ? statSync(file).size : 0;
    const r = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range ?? "");
    const start = r ? Number(r[1]) : 0;
    const end = r && r[2] ? Math.min(Number(r[2]), size - 1) : size - 1;
    const entry: DriveRequest = { id: m?.[1] ?? url.pathname, start, end, status: 0, auth };
    drive.log.push(entry);
    const answer = (status: number, body?: string) => {
      entry.status = status;
      res.writeHead(status, body ? { "Content-Type": "application/json" } : {}).end(body);
    };
    if (!auth) return answer(401, JSON.stringify({ error: { code: 401, message: "Invalid Credentials" } }));
    if (!file) return answer(404, JSON.stringify({ error: { code: 404, message: "File not found" } }));
    if (start >= size || end < start) {
      entry.status = 416;
      return res.writeHead(416, { "Content-Range": `bytes */${size}` }).end();
    }
    entry.status = r ? 206 : 200;
    res.writeHead(entry.status, {
      "Content-Type": "video/webm",
      "Content-Length": String(end - start + 1),
      "Accept-Ranges": "bytes",
      ...(r && { "Content-Range": `bytes ${start}-${end}/${size}` }),
    });
    const stream = createReadStream(file, { start, end, highWaterMark: 64 * 1024 });
    if (!drive.rate) return void stream.pipe(res);
    res.on("close", () => stream.destroy());
    stream.on("data", (b) => {
      res.write(b);
      stream.pause();
      setTimeout(() => stream.resume(), (b.length / drive.rate) * 1000);
    });
    stream.on("end", () => res.end());
  });
  drive.origin = `http://127.0.0.1:${await listen(server)}`;
  return drive;
}

/** One version the mock backend knows: project -> tape -> iteration. */
export type Fixture = { projectId: number; tapeId: number; iterationId: number; fileId: string; filename: string; size: number; kind: "vod" | "clip" };

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".txt": "text/plain; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

const pageCsp = (driveOrigin: string) =>
  "default-src 'self'; script-src 'self' 'unsafe-inline'; " +
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; " +
  `img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self' ${driveOrigin}; ` +
  "frame-ancestors 'none'; base-uri 'none'; form-action 'self'";

/** site_server._resolve_within: exact, then .html, then /index.html; nothing outside out/. */
function resolveWithin(outDir: string, rel: string): string | null {
  const root = path.resolve(outDir);
  const base = path.resolve(root, "." + rel);
  if (base !== root && !base.startsWith(root + path.sep)) return null;
  for (const c of [base, base + ".html", path.join(base, "index.html")]) {
    try {
      if (statSync(c).isFile()) return c;
    } catch {
      /* next */
    }
  }
  return null;
}

export type Backend = { origin: string; log: string[]; close(): Promise<void> };

export async function startBackend(outDir: string, drive: Drive, fixtures: Fixture[]): Promise<Backend> {
  const log: string[] = [];
  const iteration = (f: Fixture) => ({
    id: f.iterationId,
    tape_id: f.tapeId,
    version: 1,
    filename: f.filename,
    size: f.size,
    status: "ready",
    drive_file_id: f.fileId,
    uploaded_at: 1_700_000_000,
    created_at: 1_700_000_000,
    checks: null,
    has_thumbnail: false,
  });
  const tape = (f: Fixture) => ({
    id: f.tapeId,
    project_id: f.projectId,
    name: f.kind === "clip" ? "Clip reel" : "Main tape",
    kind: f.kind === "clip" ? "reel" : "tape",
    status: "in_review",
    notes: "",
    files_deleted_at: null,
    source_project_ids: f.kind === "clip" ? [f.projectId] : [],
    created_at: 1_700_000_000,
  });
  const project = (f: Fixture) => ({
    id: f.projectId,
    name: f.kind === "clip" ? "Test clip" : "Test VOD",
    stream_date: "2026-10-30",
    stream_title: "",
    vod_filename: f.filename,
    vod_size: f.size,
    vod_file_id: "vod-" + f.fileId,
    vod_status: "ready",
    download_clicked_at: null,
    kind: f.kind,
    duration_s: null,
    reel_tape_id: f.kind === "clip" ? f.tapeId : null,
  });

  function api(method: string, p: string): unknown {
    const n = (re: RegExp) => {
      const m = re.exec(p);
      return m ? Number(m[1]) : null;
    };
    const byIt = fixtures.find((f) => f.iterationId === n(/^\/iterations\/(\d+)/));
    const byTape = fixtures.find((f) => f.tapeId === n(/^\/tapes\/(\d+)$/));
    const byProject = fixtures.find((f) => f.projectId === n(/^\/projects\/(\d+)$/));
    if (p === "/me") return { username: "editor1", role: "editor", brand_kit_url: null };
    if (p === "/notifications") return { items: [], unseen: 0 };
    if (p === "/drive/space") return { limit: null, free: null };
    if (method === "GET" && byIt && /^\/iterations\/\d+$/.test(p)) return { iteration: iteration(byIt), position_s: null, comments: [] };
    if (byIt && p.endsWith("/media-link")) return { url: drive.url(byIt.fileId), access_token: TOKEN, expires_in: 3600 };
    if (byIt && p.endsWith("/seen")) return { previous_seen_at: null };
    if (byIt && (p.endsWith("/position") || p.endsWith("/comments"))) return { ok: true };
    if (byTape) return { tape: tape(byTape), iterations: [iteration(byTape)] };
    if (byProject) return { project: project(byProject), tapes: [tape(byProject)] };
    return undefined;
  }

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? "/", "http://x");
    const p = decodeURIComponent(url.pathname);
    log.push(`${req.method} ${p}`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    if (p.startsWith("/api/editor/")) {
      const body = api(req.method ?? "GET", p.slice("/api/editor".length));
      res.writeHead(body === undefined ? 404 : 200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(body ?? { error: `mock backend has no ${req.method} ${p}` }));
    }
    if (p.startsWith("/api/")) return res.writeHead(404, { "Content-Type": "application/json" }).end("{}");
    const file = resolveWithin(outDir, p);
    if (!file) return res.writeHead(404).end("Not found");
    const type = TYPES[path.extname(file)] ?? "application/octet-stream";
    const headers: Record<string, string> = { "Content-Type": type, "Content-Security-Policy": "frame-ancestors 'none'" };
    if (type.startsWith("text/html") && p !== "/" && p !== "/index.html") headers["Content-Security-Policy"] = pageCsp(drive.origin);
    if (p === "/editor/media-sw.js") headers["Service-Worker-Allowed"] = "/editor";
    res.writeHead(200, headers);
    createReadStream(file).pipe(res);
  });
  const origin = `http://127.0.0.1:${await listen(server)}`;
  return { origin, log, close: () => shut(server) };
}
