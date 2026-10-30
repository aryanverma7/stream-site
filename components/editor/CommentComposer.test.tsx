import { describe, expect, it, vi } from "vitest";
import { useRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { usePlayerKeys } from "@/lib/usePlayerKeys";
import { CommentComposer } from "./CommentComposer";

// The composer sits inside the player's container, as in ReviewPlayer: without one every key
// from inside it would be ignored for being outside the player, and the test could not fail.
function Harness({ onKey, ...p }: React.ComponentProps<typeof CommentComposer> & { onKey(): void }) {
  const box = useRef<HTMLDivElement>(null);
  usePlayerKeys({ comment: onKey, general: onKey, toggle: onKey, help: onKey }, { container: box });
  return (
    <div ref={box}>
      <span data-testid="in-player" tabIndex={-1} />
      <CommentComposer {...p} />
    </div>
  );
}
const setup = (over: Partial<React.ComponentProps<typeof CommentComposer>> = {}) => {
  const props = { start: 222, getNow: () => 230, onSubmit: vi.fn(), onCancel: vi.fn(), ...over };
  const onKey = vi.fn();
  render(<Harness onKey={onKey} {...props} />);
  return { ...props, onKey };
};

describe("CommentComposer", () => {
  it("prefills the start and submits with Ctrl+Enter", () => {
    const { onSubmit } = setup();
    expect(screen.getByLabelText("Start")).toHaveValue("3:42.0");
    fireEvent.change(screen.getByLabelText("Comment text"), { target: { value: "  cut here " } });
    fireEvent.keyDown(screen.getByLabelText("Comment text"), { key: "Enter", ctrlKey: true });
    expect(onSubmit).toHaveBeenCalledWith({ kind: "fix", body: "cut here", start_s: 222, end_s: null });
  });

  it("blocks end <= start; Set end to now fills the end", () => {
    const { onSubmit } = setup();
    fireEvent.change(screen.getByLabelText("Comment text"), { target: { value: "x" } });
    fireEvent.change(screen.getByLabelText("End"), { target: { value: "3:42" } });
    fireEvent.click(screen.getByRole("button", { name: "Add comment" }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("End must be after start");
    fireEvent.click(screen.getByRole("button", { name: "Set end to now" }));
    expect(screen.getByLabelText("End")).toHaveValue("3:50.0");
    fireEvent.click(screen.getByRole("button", { name: "Add comment" }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ start_s: 222, end_s: 230 }));
  });

  it("types c, space and ? without firing player keys; Esc cancels", () => {
    const { onKey, onCancel } = setup({ start: null });
    const box = screen.getByLabelText("Comment text");
    for (const key of ["c", " ", "?", "g"]) fireEvent.keyDown(box, { key });
    expect(onKey).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByTestId("in-player"), { key: "?" }); // the harness does pass player keys
    expect(onKey).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText("Start")).toBeNull();
    fireEvent.keyDown(box, { key: "Escape" });
    expect(onCancel).toHaveBeenCalled();
  });
});
