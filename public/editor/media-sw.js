/*
 * Plays a version to the <video> element from /editor/media/<iterationId>:
 * chunks already in OPFS come from disk, the rest are ranged fetches from
 * Drive. It never writes to OPFS (only the page's download does) and logs
 * nothing, so the access token never reaches a log. The page tells it about
 * each version with a "media" message (its link may be null when every chunk
 * is on disk); when it has no info, or needs Drive without a fresh token, it
 * asks the page with "need-link".
 */
importScripts("/editor/media-range.js");

var LINK_WAIT_MS = 15000;
var media = new Map(); // iterationId (string) -> {projectId, fileId, size, mime, link}
var waiting = new Map(); // iterationId -> [{resolve, need}]

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
  var m = { projectId: d.projectId, fileId: d.fileId, size: d.size, mime: d.mime, link: d.link };
  media.set(id, m);
  // an "info" waiter is satisfied by any answer; a "link" one only by a usable token, so a
  // downloaded version's quick link:null answer does not end a wait for Drive
  var left = (waiting.get(id) || []).filter(function (w) {
    if (w.need === "link" && !fresh(m)) return true;
    w.resolve();
    return false;
  });
  if (left.length) waiting.set(id, left);
  else waiting.delete(id);
});

function fresh(m) {
  return !!m && linkFresh(m.link, Date.now());
}

/**
 * Posts "need-link" to the page and waits (at most 15 s) for its "media" answer.
 * `need` is "info" when size and type are enough (a downloaded version may answer
 * without a link), "link" when a Drive piece needs a real token.
 */
async function ask(id, clientId, need) {
  var mine;
  var arrived = new Promise(function (resolve) {
    mine = { resolve: resolve, need: need };
    waiting.set(id, (waiting.get(id) || []).concat(mine));
  });
  var timer;
  var timeout = new Promise(function (resolve) { timer = setTimeout(resolve, LINK_WAIT_MS); });
  var client = clientId ? await self.clients.get(clientId) : null;
  var targets = client ? [client] : await self.clients.matchAll({ type: "window" });
  targets.forEach(function (c) { c.postMessage({ type: "need-link", iterationId: Number(id), need: need }); });
  await Promise.race([arrived, timeout]);
  clearTimeout(timer);
  // a timed-out wait leaves its resolver behind otherwise
  var left = (waiting.get(id) || []).filter(function (w) { return w !== mine; });
  if (left.length) waiting.set(id, left);
  else waiting.delete(id);
  return media.get(id) || null;
}

/** The version's info with a usable token, asking the page when needed; null when none came. */
async function info(id, clientId, force) {
  var m = media.get(id);
  if (!force && fresh(m)) return m;
  m = await ask(id, clientId, "link");
  return fresh(m) ? m : null;
}

async function driveStream(id, clientId, m, piece, signal) {
  for (var retried = false; ; retried = true) {
    var res = await fetch(m.link.url, {
      headers: { Authorization: "Bearer " + m.link.access_token, Range: "bytes=" + piece.from + "-" + piece.to },
      signal: signal,
    });
    if (rangeAnswered(res.status, piece.from, piece.to, m.size)) return res.body;
    if (res.body) res.body.cancel().catch(function () {}); // an unread error body would hold the connection
    if (res.status !== 401 || retried) throw new Error("Drive answered " + res.status);
    m = await info(id, clientId, true);
    if (!m) throw new Error("No playback link");
  }
}

async function serve(id, rangeHeader, clientId) {
  // size and mime are enough to plan; a token is only needed for a Drive piece
  var m = media.get(id) || (await ask(id, clientId, "info"));
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
  if (pieces.some(function (p) { return p.source === "drive"; }) && !fresh(m)) {
    m = await info(id, clientId, false);
    if (!m) return new Response("Playback link unavailable", { status: 503 });
  }

  // one controller per response: cancelling it aborts whichever Drive fetch is in flight
  var abort = new AbortController();
  async function open(p) {
    if (p.source === "drive") return driveStream(id, clientId, m, p, abort.signal);
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
        var opened = (await open(pieces[next++])).getReader();
        if (abort.signal.aborted) return opened.cancel(); // cancelled while it opened
        reader = opened;
      }
    },
    cancel() {
      abort.abort();
      return reader.cancel().catch(function () {});
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
