import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { LegalPage } from "./LegalPage";

describe("LegalPage", () => {
  it("links home with a plain document link", () => {
    render(
      <LegalPage title="Terms" updated="today">
        <p>x</p>
      </LegalPage>,
    );
    const back = screen.getByRole("link", { name: "← DualBladeX" });
    expect(back.getAttribute("href")).toBe("/");
    // next/link renders an <a> too; a plain one carries no client-router handler, which is all a test here can see
    expect(Object.keys(back).some((k) => k.startsWith("__reactProps") && typeof (back as unknown as Record<string, { onClick?: unknown }>)[k].onClick === "function")).toBe(false);
  });
});
