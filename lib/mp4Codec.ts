/**
 * The video codec of an MP4, read from the first video track's sample
 * description (moov > trak > mdia > minf > stbl > stsd), e.g. "hvc1" or
 * "avc1". Only box headers and the moov box are read, so a 4 GB file costs a
 * few MB; moov may sit after mdat (Resolve and Premiere often put it there).
 * Null when it is not an MP4 or no video track is found.
 */

const MOOV_MAX_BYTES = 64 * 1024 * 1024;
const CONTAINERS = new Set(["trak", "mdia", "minf", "stbl"]);

const fourcc = (v: DataView, at: number) => String.fromCharCode(v.getUint8(at), v.getUint8(at + 1), v.getUint8(at + 2), v.getUint8(at + 3));

async function bytes(file: Blob, start: number, end: number): Promise<DataView> {
  return new DataView(await file.slice(start, end).arrayBuffer());
}

/** Header at `at` inside `v` (or null past the end): [type, header length, box length]. */
function header(v: DataView, at: number, end: number): [string, number, number] | null {
  if (at + 8 > end) return null;
  let size = v.getUint32(at);
  const type = fourcc(v, at + 4);
  let head = 8;
  if (size === 1) {
    if (at + 16 > end) return null;
    size = Number(v.getBigUint64(at + 8));
    head = 16;
  } else if (size === 0) size = end - at;
  return size < head ? null : [type, head, size];
}

/** The first child of `type` in [start, end), as [payload start, box end]. */
function child(v: DataView, start: number, end: number, type: string): [number, number] | null {
  for (let at = start; ; ) {
    const h = header(v, at, end);
    if (!h) return null;
    if (h[0] === type) return [at + h[1], Math.min(at + h[2], end)];
    at += h[2];
  }
}

function videoEntry(v: DataView, start: number, end: number): string | null {
  for (let at = start; ; ) {
    const h = header(v, at, end);
    if (!h) return null;
    const boxEnd = Math.min(at + h[2], end);
    if (h[0] === "trak") {
      const mdia = child(v, at + h[1], boxEnd, "mdia");
      const hdlr = mdia && child(v, mdia[0], mdia[1], "hdlr");
      if (hdlr && hdlr[0] + 12 <= hdlr[1] && fourcc(v, hdlr[0] + 8) === "vide") {
        let box: [number, number] | null = mdia;
        for (const t of ["minf", "stbl", "stsd"]) box = box && child(v, box[0], box[1], t);
        // stsd: version/flags (4), entry count (4), then the first entry's size (4) and type (4)
        if (box && box[0] + 16 <= box[1]) return fourcc(v, box[0] + 12);
      }
    } else if (CONTAINERS.has(h[0])) {
      const found = videoEntry(v, at + h[1], boxEnd);
      if (found) return found;
    }
    at += h[2];
  }
}

export async function mp4VideoCodec(file: Blob): Promise<string | null> {
  try {
    for (let at = 0; at + 8 <= file.size; ) {
      const v = await bytes(file, at, Math.min(at + 16, file.size));
      const raw = v.getUint32(0);
      const h = header(v, 0, v.byteLength);
      if (!h) return null;
      const [type, head] = h;
      const boxSize = raw === 0 ? file.size - at : h[2]; // size 0 = to the end of the file
      if (boxSize < head) return null;
      if (type === "moov") {
        if (boxSize > MOOV_MAX_BYTES) return null;
        const moov = await bytes(file, at, Math.min(at + boxSize, file.size));
        return videoEntry(moov, head, moov.byteLength);
      }
      at += boxSize;
    }
  } catch {
    /* not an MP4 we can read */
  }
  return null;
}

const LABELS: Record<string, string> = { hvc1: "H.265", hev1: "H.265", avc1: "H.264", avc3: "H.264", av01: "AV1", vp09: "VP9" };
/** What a browser is asked about each codec (HEVC Main, H.264 High). */
const PROBES: Record<string, string> = {
  hvc1: 'video/mp4; codecs="hvc1.1.6.L153.B0"',
  hev1: 'video/mp4; codecs="hev1.1.6.L153.B0"',
  avc1: 'video/mp4; codecs="avc1.640028"',
  avc3: 'video/mp4; codecs="avc3.640028"',
  av01: 'video/mp4; codecs="av01.0.08M.08"',
  vp09: 'video/mp4; codecs="vp09.00.40.08"',
};

export const codecLabel = (codec: string | null | undefined): string | null => (codec && LABELS[codec]) || null;
export const codecProbe = (codec: string | null | undefined): string | null => (codec && PROBES[codec]) || null;
