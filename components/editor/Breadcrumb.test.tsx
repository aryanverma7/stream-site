import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { Breadcrumb } from "./Breadcrumb";

describe("Breadcrumb", () => {
  it("renders every level's name as a link to that level", () => {
    const { getByRole } = render(
      <Breadcrumb
        route={{ view: "iteration", projectId: 12, tapeId: 5, iterationId: 3 }}
        names={{ project: "Ranked grind", tape: "Main", version: 2 }}
      />,
    );
    expect(getByRole("link", { name: "All projects" }).getAttribute("href")).toBe("#/");
    expect(getByRole("link", { name: "Ranked grind" }).getAttribute("href")).toBe("#/p/12");
    expect(getByRole("link", { name: "Main" }).getAttribute("href")).toBe("#/p/12/t/5");
    const current = getByRole("link", { name: "v2" });
    expect(current.getAttribute("href")).toBe("#/p/12/t/5/v/3");
    expect(current.getAttribute("aria-current")).toBe("page");
  });

  it("shows a placeholder while a name is still loading", () => {
    const { getByRole } = render(
      <Breadcrumb route={{ view: "project", projectId: 12 }} names={{ project: null, tape: null, version: null }} />,
    );
    expect(getByRole("link", { name: "…" }).getAttribute("href")).toBe("#/p/12");
  });

  it("stops at the level being shown", () => {
    const { queryAllByRole } = render(
      <Breadcrumb route={{ view: "projects" }} names={{ project: null, tape: null, version: null }} />,
    );
    expect(queryAllByRole("link")).toHaveLength(1);
  });
});
