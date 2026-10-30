import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { useAsk } from "./AskDialog";

function Harness({ onAnswer, prompt = false }: { onAnswer: (v: unknown) => void; prompt?: boolean }) {
  const ask = useAsk();
  return (
    <div>
      <button
        type="button"
        onClick={async () =>
          onAnswer(
            prompt
              ? await ask.prompt({ title: "Rename", label: "New name", initial: "Old", confirmLabel: "Rename" })
              : await ask.confirm({ title: "Start over?", message: "Comments are resolved.", confirmLabel: "Start over", danger: true }),
          )
        }
      >
        Open
      </button>
      {ask.dialog}
    </div>
  );
}

describe("useAsk", () => {
  it("confirm: an alertdialog labelled by its title and message, focus on Cancel; Cancel answers false and focus goes back", async () => {
    const onAnswer = vi.fn();
    const { getByRole, findByRole, queryByRole } = render(<Harness onAnswer={onAnswer} />);
    const opener = getByRole("button", { name: "Open" });
    opener.focus();
    fireEvent.click(opener);
    const dialog = await findByRole("alertdialog", { name: "Start over?" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-describedby")).toBe(getByRole("alertdialog").querySelector("p")!.id);
    expect(document.activeElement).toBe(getByRole("button", { name: "Cancel" }));
    fireEvent.click(getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith(false));
    expect(queryByRole("alertdialog")).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it("confirm: the confirm button answers true", async () => {
    const onAnswer = vi.fn();
    const { getByRole, findByRole } = render(<Harness onAnswer={onAnswer} />);
    fireEvent.click(getByRole("button", { name: "Open" }));
    fireEvent.click(await findByRole("button", { name: "Start over" }));
    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith(true));
  });

  it("Esc cancels and goes no further (the shell behind never sees it)", async () => {
    const onAnswer = vi.fn();
    const behind = vi.fn();
    window.addEventListener("keydown", behind);
    const { getByRole, findByRole } = render(<Harness onAnswer={onAnswer} />);
    fireEvent.click(getByRole("button", { name: "Open" }));
    await findByRole("alertdialog");
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith(false));
    expect(behind).not.toHaveBeenCalled();
    window.removeEventListener("keydown", behind);
  });

  it("a click on the backdrop cancels; one inside the panel does not", async () => {
    const onAnswer = vi.fn();
    const { getByRole, findByRole } = render(<Harness onAnswer={onAnswer} />);
    fireEvent.click(getByRole("button", { name: "Open" }));
    const dialog = await findByRole("alertdialog");
    fireEvent.mouseDown(dialog);
    expect(onAnswer).not.toHaveBeenCalled();
    fireEvent.mouseDown(dialog.parentElement!);
    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith(false));
  });

  it("traps Tab inside the dialog, both ways", async () => {
    const { getByRole, findByRole } = render(<Harness onAnswer={() => {}} />);
    fireEvent.click(getByRole("button", { name: "Open" }));
    await findByRole("alertdialog");
    const cancel = getByRole("button", { name: "Cancel" });
    const ok = getByRole("button", { name: "Start over" });
    ok.focus();
    fireEvent.keyDown(ok, { key: "Tab" });
    expect(document.activeElement).toBe(cancel);
    fireEvent.keyDown(cancel, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(ok);
  });

  it("prompt: focuses the field with the initial value, refuses an empty answer, answers the trimmed text", async () => {
    const onAnswer = vi.fn();
    const { getByRole, findByRole, getByLabelText } = render(<Harness onAnswer={onAnswer} prompt />);
    fireEvent.click(getByRole("button", { name: "Open" }));
    await findByRole("dialog", { name: "Rename" });
    const field = getByLabelText("New name") as HTMLInputElement;
    expect(document.activeElement).toBe(field);
    expect(field.value).toBe("Old");
    fireEvent.change(field, { target: { value: "   " } });
    expect(getByRole("button", { name: "Rename" })).toBeDisabled();
    fireEvent.submit(field.form!);
    expect(onAnswer).not.toHaveBeenCalled();
    fireEvent.change(field, { target: { value: "  New one " } });
    await act(async () => fireEvent.submit(field.form!));
    expect(onAnswer).toHaveBeenCalledWith("New one");
  });

  it("prompt: Cancel answers null", async () => {
    const onAnswer = vi.fn();
    const { getByRole, findByRole } = render(<Harness onAnswer={onAnswer} prompt />);
    fireEvent.click(getByRole("button", { name: "Open" }));
    fireEvent.click(await findByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith(null));
  });
});
