import { describe, expect, it, vi, afterEach } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react";
import { DeleteDialog } from "./DeleteDialog";
import { editorBackend } from "@/lib/testUtils";

function open(onDone = vi.fn(), onClose = vi.fn()) {
  const utils = render(
    <DeleteDialog kind="tape_files" targetId={5} label="Jett dash" title="Delete files" onClose={onClose} onDone={onDone} />,
  );
  return { ...utils, input: utils.getByLabelText("Type the name to confirm"), button: utils.getByRole("button", { name: "Delete in an hour" }) as HTMLButtonElement };
}

describe("DeleteDialog", () => {
  afterEach(() => vi.restoreAllMocks());

  it("enables the button only on the exact name, then requests the delete", async () => {
    const fetchMock = editorBackend({ "POST /deletions": { request_id: 1, delete_at: 1, label: "Jett dash" } });
    const onDone = vi.fn();
    const { input, button } = open(onDone);

    expect(button.disabled).toBe(true);
    fireEvent.change(input, { target: { value: "jett dash" } });
    expect(button.disabled).toBe(true);
    fireEvent.change(input, { target: { value: "Jett dash " } });
    expect(button.disabled).toBe(true);
    fireEvent.change(input, { target: { value: "Jett dash" } });
    expect(button.disabled).toBe(false);

    fireEvent.click(button);
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]!.body))).toEqual({ kind: "tape_files", target_id: 5, confirm: "Jett dash" });
  });

  it("shows the server's refusal and stays open", async () => {
    editorBackend({ "POST /deletions": { status: 400, body: { error: "Wait for the upload to finish first" } } });
    const onDone = vi.fn();
    const { input, button, findByRole } = open(onDone);
    fireEvent.change(input, { target: { value: "Jett dash" } });
    fireEvent.click(button);
    expect((await findByRole("alert")).textContent).toBe("Wait for the upload to finish first");
    expect(onDone).not.toHaveBeenCalled();
  });

  it("closes on Esc without letting it reach the page", () => {
    const onClose = vi.fn();
    const reached = vi.fn();
    window.addEventListener("keydown", reached);
    const { input } = open(vi.fn(), onClose);
    fireEvent.keyDown(input, { key: "Escape" });
    fireEvent.keyDown(document.body, { key: "Escape" });
    window.removeEventListener("keydown", reached);
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(reached).not.toHaveBeenCalled();
  });
});
