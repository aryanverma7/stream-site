import { describe, expect, it, vi, afterEach } from "vitest";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { QuotaCard, QuotaView, gap } from "./QuotaView";
import { daysLeft, weekLabel, type QuotaWeek } from "@/lib/useQuota";
import { editorBackend } from "@/lib/testUtils";

const week = (w: string, done: [number, number], status: QuotaWeek["status"], extra: Partial<QuotaWeek> = {}): QuotaWeek => {
  const target = { videos: 2, reels: 10 };
  const d = { videos: done[0], reels: done[1] };
  return {
    week: w, target, done: d, status, excused: status === "excused", note: "", edits: [],
    short: { videos: Math.max(0, 2 - d.videos), reels: Math.max(0, 10 - d.reels) }, ...extra,
  };
};

const quota = {
  start_week: "2026-11-09",
  current_week: "2026-11-23",
  week_ends_at: Date.UTC(2026, 10, 30) / 1000,
  targets: { videos: 2, reels: 10 },
  weeks: [
    week("2026-11-23", [1, 4], "in_progress"),
    week("2026-11-16", [2, 7], "missed", {
      edits: [{ id: 5, name: "Ace clutch", kind: "video", project_id: 3, project_name: "Stream A", final_upload_at: 1763380800 }],
    }),
    week("2026-11-09", [3, 10], "met"),
  ],
};

describe("quota", () => {
  afterEach(() => vi.restoreAllMocks());

  it("labels weeks and counts days left", () => {
    expect(weekLabel("2026-11-16")).toBe("16 Nov - 22 Nov");
    expect(daysLeft(Date.UTC(2026, 10, 23) / 1000, Date.UTC(2026, 10, 20, 12))).toBe(3);
    expect(daysLeft(0, 1000)).toBe(1);
  });

  it("says what was short, or what was extra", () => {
    expect(gap(quota.weeks[1])).toBe("3 reels & clips short");
    expect(gap(week("2026-11-16", [1, 9], "missed"))).toBe("1 video, 1 reel or clip short");
    expect(gap(quota.weeks[2])).toBe("+1 video");
    expect(gap(week("2026-11-16", [2, 10], "met"))).toBe("");
  });

  it("shows every week with its status and what counted, and links each edit", async () => {
    editorBackend({ "/quota": quota });
    const { findByText, getAllByRole, getByText } = render(<QuotaView role="editor" />);
    expect(await findByText("16 Nov - 22 Nov")).toBeTruthy();
    expect(getAllByRole("row").filter((r) => r.querySelector("td.font-bold")).map((r) => r.textContent)).toEqual([
      "23 Nov - 29 Nov1/24/10This week1 video, 6 reels & clips short",
      "16 Nov - 22 Nov2/27/10Missed3 reels & clips short",
      "9 Nov - 15 Nov3/210/10Met+1 video",
    ]);
    expect(getByText("Ace clutch").getAttribute("href")).toBe("#/p/3/t/5");
    expect(getByText(/1 of 2 past weeks missed/)).toBeTruthy();
    expect(() => getByText("Quota settings")).toThrow(); // the editor gets no settings
    expect(() => getByText("Excuse week")).toThrow();
  });

  it("lets the streamer excuse a missed week with a note", async () => {
    const mock = editorBackend({
      "/quota": quota,
      "PUT /quota/excused": (body: unknown) => ({ ...quota, weeks: [quota.weeks[0], { ...quota.weeks[1], status: "excused", excused: true, note: (body as { note: string }).note }, quota.weeks[2]] }),
    });
    const { findAllByText, getByLabelText, getByText, findByText } = render(<QuotaView role="admin" />);
    fireEvent.click((await findAllByText("Excuse week"))[0]);
    fireEvent.change(getByLabelText("Reason (optional)"), { target: { value: "holiday" } });
    fireEvent.click(getByText("Excuse week", { selector: "dialog button, [role=dialog] button" }));
    expect(await findByText("holiday")).toBeTruthy();
    const put = mock.mock.calls.find(([, init]) => init?.method === "PUT")!;
    expect(JSON.parse(String(put[1]!.body))).toEqual({ week: "2026-11-23", excused: true, note: "holiday" });
  });

  it("the Home card shows this week and nothing at all when the quota can't be read", async () => {
    editorBackend({ "/quota": quota });
    const { findByRole } = render(<QuotaCard />);
    const videos = await findByRole("meter", { name: "Videos" });
    expect(videos.getAttribute("aria-valuenow")).toBe("1");

    editorBackend({});
    const { container } = render(<QuotaCard />);
    await waitFor(() => expect(container.innerHTML).toBe(""));
  });
});
