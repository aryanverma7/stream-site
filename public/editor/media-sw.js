/*
 * Plays a version to the <video> element from /editor/media/<iterationId>:
 * chunks already in OPFS come from disk, the rest are ranged fetches from
 * Drive. It never writes to OPFS (only the page's download does) and logs
 * nothing, so the access token never reaches a log. The page tells it about
 * each version with a "media" message; when it has no info or no fresh token
 * it asks the page with "need-link".
 */
importScripts("/editor/media-range.js");

var LINK_WAIT_MS = 15000;
var media = new Map(); // iterationId (string) -> {projectId, fileId, size, mime, link, at}
var waiting = new Map(); // iterationId -> [resolve]

self.addEventListener("install", function () {
  self.skipWaiting();
});
self.addEventListener("activate", function (e) {
  e.waitUntil(self.clients.claim()); // control the page on its first visit
});

self.addEventListener("message", function (e) {
  var d = e.data;
  if (!d || d.type !== "media") return;
  var id = String(d.iterationId);
  media.set(id, { projectId: d.projectId, fileId: d.fileId, size: d.size, mime: d.mime, link: d.link, at: Date.now() });
  (waiting.get(id) || []).forEach(function (resolve) { resolve(); });
  waiting.delete(id);
});

function fresh(m) {
  return m && m.link && Date.now() - m.at < (m.link.expires_in - 60) * 1000;
}

/** The version's info with a usable token, asking the page when needed; null after 15 s. */
async function info(id, clientId, force) {
  var m = media.get(id);
  if (!force && fresh(m)) return m;
  var arrived = new Promise(function (resolve) {
    waiting.set(id, (waiting.get(id) || []).concat(resolve));
  });
  var client = clientId ? await self.clients.get(clientId) : null;
  var targets = client ? [client] : await self.clients.matchAll({ type: "window" });
  targets.forEach(function (c) { c.postMessage({ type: "need-link", iterationId: Number(id) }); });
  var timeout = new Promise(function (resolve) { setTimeout(resolve, LINK_WAIT_MS); });
  await Promise.race([arrived, timeout]);
  m = media.get(id);
  return fresh(m) ? m : null;
}

async function driveStream(id, clientId, m, piece) {
  for (var retried = false; ; retried = true) {
    var res = await fetch(m.link.url, {
      headers: { Authorization: "Bearer " + m.link.access_token, Range: "bytes=" + piece.from + "-" + piece.to },
    });
    if (res.status === 206) return res.body;
    if (res.status !== 401 || retried) throw new Error("Drive answered " + res.status);
    m = await info(id, clientId, true);
    if (!m) throw new Error("No playback link");
  }
}

async function serve(id, rangeHeader, clientId) {
  var m = await info(id, clientId, false);
  if (!m) return new Response("Playback link unavailable", { status: 503 });
  var r = parseRange(rangeHeader, m.size);
  if (!r) return new Response(null, { status: 416, headers: { "Content-Range": "bytes */" + m.size } });

  var dir = null;
  try {
    var root = await navigator.storage.getDirectory();
    dir = await root.getDirectoryHandle(dirName(m.projectId, Number(id), m.fileId));
  } catch {
    dir = null; // nothing downloaded yet
  }
  var present = [];
  for (var c = Math.floor(r.start / CHUNK_BYTES); c <= Math.floor(r.end / CHUNK_BYTES); c++) {
    try {
      present[c] = dir !== null && (await (await dir.getFileHandle(chunkName(c))).getFile()).size === chunkLength(m.size, c);
    } catch {
      present[c] = false;
    }
  }
  var pieces = planRange(r.start, r.end, present);

  async function open(p) {
    if (p.source === "drive") return driveStream(id, clientId, m, p);
    var base = p.chunk * CHUNK_BYTES;
    var file = await (await dir.getFileHandle(chunkName(p.chunk))).getFile();
    return file.slice(p.from - base, p.to + 1 - base).stream();
  }

  var next = 1;
  var reader;
  try {
    reader = (await open(pieces[0])).getReader(); // a first failure is a status, not a broken body
  } catch {
    return new Response("Could not read the video", { status: 502 });
  }
  var body = new ReadableStream({
    async pull(ctl) {
      for (;;) {
        var chunk = await reader.read();
        if (!chunk.done) return ctl.enqueue(chunk.value);
        if (next >= pieces.length) return ctl.close();
        reader = (await open(pieces[next++])).getReader();
      }
    },
    cancel() {
      return reader.cancel();
    },
  });
  return new Response(body, {
    status: 206,
    headers: {
      "Content-Range": "bytes " + r.start + "-" + r.end + "/" + m.size,
      "Content-Length": String(r.end - r.start + 1),
      "Accept-Ranges": "bytes",
      "Content-Type": m.mime,
    },
  });
}

self.addEventListener("fetch", function (e) {
  var url = new URL(e.request.url);
  var match = url.origin === self.location.origin && /^\/editor\/media\/(\d+)$/.exec(url.pathname);
  if (!match) return; // everything else goes to the network untouched
  e.respondWith(serve(match[1], e.request.headers.get("Range"), e.clientId));
});
