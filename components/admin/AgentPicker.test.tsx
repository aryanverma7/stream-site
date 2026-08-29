import { describe, expect, it, vi, afterEach } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react";
import { AgentPicker } from "./AgentPicker";
import { asFetchMock } from "@/lib/testUtils";

const AGENTS = {
  current: "jett",
  agents: [
    { name: "cypher", kit_cost: 600 },
    { name: "jett", kit_cost: 900 },
  ],
};

function respondingWith(body: unknown, ok = true) {
  return vi.fn().mockResolvedValue({ ok, status: ok ? 200 : 502, json: () => Promise.resolve(body) });
}

describe("AgentPicker", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("names the agent and what it reserves", async () => {
    global.fetch = asFetchMock(respondingWith(AGENTS));

    const { container } = render(<AgentPicker />);

    await waitFor(() => expect(container.textContent).toContain("jett"));
    expect(container.textContent).toContain("900");
  });

  it("says the prices are missing rather than showing a zero", async () => {
    // Zero would read as "this agent's abilities are free", which would
    // hand the whole credit budget to the gun.
    global.fetch = asFetchMock(
      respondingWith({ current: "someagent", agents: [{ name: "someagent", kit_cost: null }] }),
    );

    const { container } = render(<AgentPicker />);

    await waitFor(() => expect(container.textContent).toContain("someagent"));
    expect(container.textContent).toContain("no ability prices on file");
  });

  it("says nothing is set rather than picking one", async () => {
    global.fetch = asFetchMock(respondingWith({ current: null, agents: [] }));

    const { container } = render(<AgentPicker />);

    await waitFor(() => expect(container.textContent).toContain("Not set"));
  });

  it("switches agent when one is clicked", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(AGENTS) })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ agent: "cypher", kit_cost: 600 }),
      });
    global.fetch = asFetchMock(fetchMock);

    const { getByText, container } = render(<AgentPicker />);
    await waitFor(() => expect(container.textContent).toContain("cypher"));

    fireEvent.click(getByText("cypher"));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/agents", expect.objectContaining({ method: "POST" })),
    );
  });

  it("accepts an agent that isn't in the price table", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(AGENTS) })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ agent: "someagent", kit_cost: null }),
      });
    global.fetch = asFetchMock(fetchMock);

    const { getByText, getByPlaceholderText, container } = render(<AgentPicker />);
    await waitFor(() => expect(container.textContent).toContain("jett"));

    fireEvent.change(getByPlaceholderText("another agent"), { target: { value: "someagent" } });
    fireEvent.click(getByText("Set"));

    await waitFor(() => expect(container.textContent).toContain("someagent"));
  });

  it("cannot submit an empty name", async () => {
    global.fetch = asFetchMock(respondingWith(AGENTS));

    const { getByText, container } = render(<AgentPicker />);
    await waitFor(() => expect(container.textContent).toContain("jett"));

    expect(getByText("Set")).toBeDisabled();
  });

  it("shows an error from a backend that has no agents route", async () => {
    global.fetch = asFetchMock(respondingWith({}, false));

    const { container } = render(<AgentPicker />);

    await waitFor(() => expect(container.textContent).toContain("502"));
  });
});
