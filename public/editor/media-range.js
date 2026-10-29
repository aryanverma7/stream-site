/*
 * Pure range logic for the playback service worker (media-sw.js loads it with
 * importScripts; lib/mediaRange.test.ts imports it). CHUNK_BYTES, chunkName,
 * dirName and chunkLength repeat lib/opfsMedia.ts, which the worker cannot
 * import; the test pins that the two agree.
 */
var CHUNK_BYTES = 32 * 1024 * 1024;

function chunkName(i) {
  return "c" + String(i).padStart(5, "0");
}

function dirName(projectId, iterationId, fileId) {
  return "it-" + projectId + "-" + iterationId + "-" + fileId;
}

function chunkLength(size, i) {
  return Math.min(size, (i + 1) * CHUNK_BYTES) - i * CHUNK_BYTES;
}

/** {start, end} (inclusive) to answer, at most CHUNK_BYTES long; null means 416. */
function parseRange(header, size) {
  var start = 0;
  var end = size - 1;
  if (header) {
    var m = /^bytes=(\d+)-(\d*)$/.exec(header.trim());
    if (!m) return null;
    start = Number(m[1]);
    if (m[2]) end = Math.min(Number(m[2]), size - 1);
  }
  if (start >= size || end < start) return null;
  return { start: start, end: Math.min(end, start + CHUNK_BYTES - 1) };
}

/**
 * The pieces that make up start..end, in order. `from`/`to` are inclusive
 * offsets into the whole file for both sources; neighbouring Drive pieces are
 * merged so a gap is one request.
 */
function planRange(start, end, present) {
  var pieces = [];
  for (var c = Math.floor(start / CHUNK_BYTES); c * CHUNK_BYTES <= end; c++) {
    var from = Math.max(start, c * CHUNK_BYTES);
    var to = Math.min(end, (c + 1) * CHUNK_BYTES - 1);
    var last = pieces[pieces.length - 1];
    if (present[c]) pieces.push({ source: "disk", chunk: c, from: from, to: to });
    else if (last && last.source === "drive") last.to = to;
    else pieces.push({ source: "drive", from: from, to: to });
  }
  return pieces;
}

/** A link is usable until a minute before its absolute expires_at (ms epoch). */
function linkFresh(link, now) {
  return !!link && typeof link.expires_at === "number" && now < link.expires_at - 60000;
}

/** Drive answered a ranged request: a 206, or a 200 when the range was the whole file. */
function rangeAnswered(status, from, to, size) {
  return status === 206 || (status === 200 && from === 0 && to === size - 1);
}

if (typeof module !== "undefined") {
  module.exports = { CHUNK_BYTES: CHUNK_BYTES, chunkName: chunkName, dirName: dirName, chunkLength: chunkLength, parseRange: parseRange, planRange: planRange, linkFresh: linkFresh, rangeAnswered: rangeAnswered };
}
