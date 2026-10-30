import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { KeySheet } from "./KeySheet";

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open sheet</button>
      <button>Other</button>
      {open && <KeySheet onClose={() => setOpen(false)} />}
    </>
  );
}

describe("KeySheet", () => {
  it("moves focus in on open, keeps Tab inside, and gives focus back on close", () => {
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Open sheet" });
    opener.focus();
    fireEvent.click(opener);
    const close = screen.getByRole("button", { name: "Close" });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(close, { key: "Tab" });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(close, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(close);
    fireEvent.click(close);
    expect(document.activeElement).toBe(opener);
  });
});
