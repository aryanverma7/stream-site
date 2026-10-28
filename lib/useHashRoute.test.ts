import { describe, expect, it, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { parseHash, routeHash, parentRoute, useHashRoute, type Route } from "./useHashRoute";

const FORMS: [string, Route][] = [
  ["#/", { view: "projects" }],
  ["#/home", { view: "home" }],
  ["#/fixes", { view: "fixes" }],
  ["#/storage", { view: "storage" }],
  ["#/todo", { view: "todo" }],
  ["#/p/12", { view: "project", projectId: 12 }],
  ["#/p/12/t/5", { view: "tape", projectId: 12, tapeId: 5 }],
  ["#/p/12/t/5/v/3", { view: "iteration", projectId: 12, tapeId: 5, iterationId: 3 }],
  ["#/p/12/t/5/v/3@222.5", { view: "iteration", projectId: 12, tapeId: 5, iterationId: 3, seekS: 222.5 }],
];

describe("parseHash / routeHash", () => {
  it.each(FORMS)("%s round-trips", (hash, route) => {
    expect(parseHash(hash)).toEqual(route);
    expect(routeHash(route)).toBe(hash);
  });

  it.each(["", "#", "#/nope", "#/p/x", "#/p/12/t", "#/p/12/v/3", "#/p/12/t/5/v/3@abc", "#/constructor", "#/p/0",
    "#/p/12/t/0", "#/p/12/t/5/v/0", "#/p/99999999999999999999"])(
    "%j falls back to projects",
    (hash) => expect(parseHash(hash)).toEqual({ view: "projects" }),
  );
});

it("drops a seek that is not a finite number of seconds", () => {
  expect(parseHash(`#/p/12/t/5/v/3@${"9".repeat(400)}`)).toEqual({
    view: "iteration", projectId: 12, tapeId: 5, iterationId: 3,
  });
});

describe("parentRoute", () => {
  it("goes one level out from each level", () => {
    expect(parentRoute(FORMS[8][1])).toEqual({ view: "tape", projectId: 12, tapeId: 5 });
    expect(parentRoute(FORMS[7][1])).toEqual({ view: "tape", projectId: 12, tapeId: 5 });
    expect(parentRoute(FORMS[6][1])).toEqual({ view: "project", projectId: 12 });
    expect(parentRoute(FORMS[5][1])).toEqual({ view: "projects" });
  });

  it("has nothing above the top-level views", () => {
    for (const view of ["projects", "home", "fixes", "storage", "todo"] as const) {
      expect(parentRoute({ view })).toBeNull();
    }
  });
});

describe("useHashRoute", () => {
  afterEach(() => {
    window.location.hash = "";
  });

  it("reads the current hash and follows hashchange (Back included)", () => {
    window.location.hash = "#/p/12";
    const { result } = renderHook(() => useHashRoute());
    expect(result.current.route).toEqual({ view: "project", projectId: 12 });

    act(() => {
      window.location.hash = "#/p/12/t/5";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(result.current.route).toEqual({ view: "tape", projectId: 12, tapeId: 5 });
  });

  it("go() writes the hash and up() moves one level out", () => {
    const { result } = renderHook(() => useHashRoute());
    act(() => {
      result.current.go({ view: "iteration", projectId: 12, tapeId: 5, iterationId: 3 });
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(window.location.hash).toBe("#/p/12/t/5/v/3");

    act(() => {
      result.current.up();
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(window.location.hash).toBe("#/p/12/t/5");
  });

  it("up() at the top does nothing", () => {
    window.location.hash = "#/home";
    const { result } = renderHook(() => useHashRoute());
    act(() => result.current.up());
    expect(window.location.hash).toBe("#/home");
  });
});
