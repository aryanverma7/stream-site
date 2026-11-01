import { describe, expect, it } from "vitest";
import type { Comment } from "./useComments";
import { formatTc, markersOf, parseTc, toEdl, toXmeml } from "./markerExport";

const c = (over: Partial<Comment>): Comment =>
  ({
    id: 1, kind: "fix", author: "aryan", body: "cut faster", start_s: 3.2, end_s: null, created_at: 1, updated_at: 1,
    resolved: false, carried: false, origin_iteration_id: 1, origin_version: 1, replies: [], ...over,
  }) as Comment;

describe("timecode", () => {
  it("parses and formats at the nominal rate (59.94 counts as 60)", () => {
    expect(parseTc("01:00:00:00", 60)).toBe(216000);
    expect(parseTc("01:00:00:00", 59.94)).toBe(216000);
    expect(formatTc(216000 + 192, 60)).toBe("01:00:03:12");
    expect(parseTc("01:00:00:60", 60)).toBeNull();
    expect(parseTc("nonsense", 60)).toBeNull();
  });
});

describe("markersOf", () => {
  it("keeps only open, timed, non-carried comments, in time order, with replies in the note", () => {
    const m = markersOf(
      [
        c({ id: 1, start_s: 10, replies: [{ id: 9, comment_id: 1, author: "cutter", body: "done?", created_at: 2 }] as Comment["replies"] }),
        c({ id: 2, start_s: 2, end_s: 4, kind: "question" }),
        c({ id: 3, resolved: true }),
        c({ id: 4, carried: true }),
        c({ id: 5, start_s: null }),
      ],
      60,
    );
    expect(m.map((x) => x.start)).toEqual([120, 600]);
    expect(m[0]).toMatchObject({ name: "Question · aryan", length: 120 });
    expect(m[1]).toMatchObject({ name: "Fix · aryan", note: "cut faster / cutter: done?", length: 1 });
  });
});

describe("toEdl", () => {
  it("writes Resolve's marker EDL with colour, note and duration", () => {
    const edl = toEdl({ comments: [c({}), c({ kind: "keep", start_s: 5, end_s: 6, body: "nice" })], fps: 60, startTc: "01:00:00:00", title: "Jett dash v2" });
    expect(edl).toBe(
      [
        "TITLE: Jett dash v2",
        "FCM: NON-DROP FRAME",
        "",
        "001  001      V     C        01:00:03:12 01:00:03:13 01:00:03:12 01:00:03:13  ",
        " |C:ResolveColorRed |M:Fix · aryan - cut faster |D:1",
        "",
        "002  001      V     C        01:00:05:00 01:00:05:01 01:00:05:00 01:00:05:01  ",
        " |C:ResolveColorGreen |M:Keep · aryan - nice |D:60",
        "",
      ].join("\n"),
    );
  });

  it("keeps the note on one line, without Resolve's separator", () => {
    const edl = toEdl({ comments: [c({ body: "a | b\nc" })], fps: 60, startTc: "00:00:00:00", title: "t" });
    expect(edl).toContain("|M:Fix · aryan - a / b c |D:1");
  });

  it("prefixes a leading digit so Resolve does not misread it", () => {
    const edl = toEdl({ comments: [c({ author: "2fast" })], fps: 60, startTc: "00:00:00:00", title: "t" });
    expect(edl).toContain("|M:Fix · 2fast");
    const digit = toEdl({ comments: [c({})], fps: 60, startTc: "00:00:00:00", title: "3rd cut" });
    expect(digit).toContain("TITLE: _3rd cut");
  });

  it("is header-only with nothing to export", () => {
    expect(toEdl({ comments: [c({ resolved: true })], fps: 60, startTc: "01:00:00:00", title: "t" })).toBe("TITLE: t\nFCM: NON-DROP FRAME\n");
  });
});

describe("toXmeml", () => {
  it("writes an escaped FCP7 sequence with point and range markers", () => {
    const x = toXmeml({ comments: [c({ body: 'say "hi" <now> & go' }), c({ start_s: 2, end_s: 4 })], fps: 59.94, startTc: "01:00:00:00", title: "A & B" });
    expect(x).toContain("<name>A &amp; B</name>");
    expect(x).toContain("<rate><timebase>60</timebase><ntsc>TRUE</ntsc></rate>");
    expect(x).toContain("<string>01:00:00:00</string><frame>216000</frame>");
    expect(x).toContain("<marker><name>Fix · aryan</name><comment>cut faster</comment><in>120</in><out>240</out></marker>");
    expect(x).toContain("<comment>say &quot;hi&quot; &lt;now&gt; &amp; go</comment><in>192</in><out>-1</out>");
    expect(x.indexOf("<in>120</in>")).toBeLessThan(x.indexOf("<in>192</in>"));
  });
});
