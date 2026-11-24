import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Spheres } from "./Spheres";

// jsdom has no WebGL, so Spheres takes its no-WebGL path.
vi.stubGlobal("matchMedia", () => ({ matches: false }));

describe("Spheres", () => {
  it("keeps the system cursor when WebGL is unavailable", () => {
    render(<Spheres />);
    expect(screen.getByTestId("spheres").className).not.toContain("cursor-none");
  });

  it("clears the door's flash when Back restores the page from the bfcache", () => {
    const { container } = render(<Spheres />);
    const flash = container.querySelector<HTMLDivElement>(".z-40")!;
    flash.style.opacity = "1";

    window.dispatchEvent(Object.assign(new Event("pageshow"), { persisted: false }));
    expect(flash.style.opacity).toBe("1");

    window.dispatchEvent(Object.assign(new Event("pageshow"), { persisted: true }));
    expect(flash.style.opacity).toBe("0");
  });
});
