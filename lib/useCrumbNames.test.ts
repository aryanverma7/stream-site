import { describe, expect, it, vi, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useCrumbNames } from "./useCrumbNames";
import { asFetchMock } from "./testUtils";

const PROJECT = { project: { id: 12, name: "Ranked grind", stream_date: "2026-10-20" }, tapes: [] };
const TAPE = { tape: { id: 5, name: "Main", project_id: 12 }, iterations: [{ id: 3, version: 2 }] };

/** Answers each /api/editor path from the table; anything absent is a 404. */
function backend(table: Record<string, unknown>) {
  return vi.fn((url: string) => {
    const body = table[url.replace("/api/editor", "")];
    return Promise.resolve(
      body === undefined
        ? { ok: false, status: 404, json: () => Promise.resolve({ error: "Not found" }) }
        : { ok: true, status: 200, json: () => Promise.resolve(body) },
    );
  });
}

describe("useCrumbNames", () => {
  afterEach(() => vi.restoreAllMocks());

  it("fetches nothing for top-level views", () => {
    const fetchMock = backend({});
    global.fetch = asFetchMock(fetchMock);
    const { result } = renderHook(() => useCrumbNames({ view: "home" }, vi.fn()));
    expect(result.current).toEqual({ project: null, tape: null, version: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("names the project, tape and version of an iteration route", async () => {
    global.fetch = asFetchMock(backend({ "/projects/12": PROJECT, "/tapes/5": TAPE }));
    const onMissing = vi.fn();
    const { result } = renderHook(() =>
      useCrumbNames({ view: "iteration", projectId: 12, tapeId: 5, iterationId: 3 }, onMissing),
    );
    await waitFor(() => expect(result.current).toEqual({ project: "Ranked grind", tape: "Main", version: 2 }));
    expect(onMissing).not.toHaveBeenCalled();
  });

  it("falls back to the projects list when the project is gone", async () => {
    global.fetch = asFetchMock(backend({}));
    const onMissing = vi.fn();
    renderHook(() => useCrumbNames({ view: "tape", projectId: 12, tapeId: 5 }, onMissing));
    await waitFor(() => expect(onMissing).toHaveBeenCalledWith({ view: "projects" }));
  });

  it("falls back to the project when the tape is gone", async () => {
    global.fetch = asFetchMock(backend({ "/projects/12": PROJECT }));
    const onMissing = vi.fn();
    renderHook(() => useCrumbNames({ view: "tape", projectId: 12, tapeId: 5 }, onMissing));
    await waitFor(() => expect(onMissing).toHaveBeenCalledWith({ view: "project", projectId: 12 }));
  });

  it("treats a tape from another project as missing", async () => {
    global.fetch = asFetchMock(
      backend({ "/projects/12": PROJECT, "/tapes/5": { ...TAPE, tape: { ...TAPE.tape, project_id: 99 } } }),
    );
    const onMissing = vi.fn();
    renderHook(() => useCrumbNames({ view: "tape", projectId: 12, tapeId: 5 }, onMissing));
    await waitFor(() => expect(onMissing).toHaveBeenCalledWith({ view: "project", projectId: 12 }));
  });

  it("falls back to the tape when the version is not on it", async () => {
    global.fetch = asFetchMock(backend({ "/projects/12": PROJECT, "/tapes/5": TAPE }));
    const onMissing = vi.fn();
    renderHook(() =>
      useCrumbNames({ view: "iteration", projectId: 12, tapeId: 5, iterationId: 77 }, onMissing),
    );
    await waitFor(() => expect(onMissing).toHaveBeenCalledWith({ view: "tape", projectId: 12, tapeId: 5 }));
  });

  it("does not treat a server error as a deletion", async () => {
    global.fetch = asFetchMock(
      vi.fn().mockResolvedValue({ ok: false, status: 502, json: () => Promise.resolve({ error: "x" }) }),
    );
    const onMissing = vi.fn();
    const { result } = renderHook(() => useCrumbNames({ view: "project", projectId: 12 }, onMissing));
    await new Promise((r) => setTimeout(r, 10));
    expect(onMissing).not.toHaveBeenCalled();
    expect(result.current.project).toBeNull();
  });
});
