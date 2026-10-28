import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";

vi.mock("@/lib/useTransfers", () => ({ startUpload: vi.fn(async () => {}) }));

import { UploadDrop } from "./UploadDrop";
import { startUpload } from "@/lib/useTransfers";

const file = (name = "jett.mp4") => new File(["x"], name, { type: "video/mp4" });

describe("UploadDrop", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uploads a dropped file to this tape", () => {
    const onUploaded = vi.fn();
    const { getByText } = render(<UploadDrop tapeId={5} projectId={12} kind="reel" disabled={false} onUploaded={onUploaded} />);
    fireEvent.drop(getByText(/Drop a new version/), { dataTransfer: { files: [file()] } });
    expect(startUpload).toHaveBeenCalledWith({ tapeId: 5, projectId: 12, kind: "reel" }, expect.any(File), onUploaded);
  });

  it("uploads a picked file", () => {
    const { getByLabelText } = render(<UploadDrop tapeId={5} projectId={12} kind="tape" disabled={false} onUploaded={() => {}} />);
    fireEvent.change(getByLabelText(/choose a file/), { target: { files: [file()] } });
    expect(startUpload).toHaveBeenCalledOnce();
  });

  it("takes one file per drop", () => {
    const { getByText, getByRole } = render(<UploadDrop tapeId={5} projectId={12} kind="tape" disabled={false} onUploaded={() => {}} />);
    fireEvent.drop(getByText(/Drop a new version/), { dataTransfer: { files: [file("a.mp4"), file("b.mp4")] } });
    expect(startUpload).not.toHaveBeenCalled();
    expect(getByRole("alert").textContent).toBe("One file at a time.");
  });

  it("refuses while a delete is pending", () => {
    const { getByText, getByLabelText } = render(<UploadDrop tapeId={5} projectId={12} kind="tape" disabled onUploaded={() => {}} />);
    fireEvent.drop(getByText(/Drop a new version/), { dataTransfer: { files: [file()] } });
    expect(startUpload).not.toHaveBeenCalled();
    expect(getByLabelText(/choose a file/)).toBeDisabled();
  });
});
