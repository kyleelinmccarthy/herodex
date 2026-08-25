import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QuestLog } from "./quest-log";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/lib/actions/activities", () => ({
  updateActivity: vi.fn().mockResolvedValue(undefined),
  deleteActivity: vi.fn().mockResolvedValue(undefined),
}));

import { updateActivity } from "@/lib/actions/activities";

const subjects = [{ id: "s1", name: "Math", color: "#ef4444" }];

const baseActivity = {
  id: "a1",
  title: "Read Chapter 5",
  date: "2026-08-25",
  durationMinutes: 30,
  description: null as string | null,
  subjectId: "s1",
};

beforeEach(() => {
  vi.mocked(updateActivity).mockClear();
});

afterEach(cleanup);

describe("QuestLog", () => {
  it("invites notes on a chronicled quest that has none", () => {
    render(<QuestLog activities={[baseActivity]} subjects={subjects} />);
    expect(screen.getByText("Add Notes")).toBeInTheDocument();
  });

  it("shows the notes already written on a quest", () => {
    const activity = { ...baseActivity, description: "Read pages 50-75" };
    render(<QuestLog activities={[activity]} subjects={subjects} />);
    expect(screen.getByText("Read pages 50-75")).toBeInTheDocument();
    expect(screen.getByText("Edit")).toBeInTheDocument();
  });

  it("saves notes alongside the duration", async () => {
    const user = userEvent.setup();
    render(<QuestLog activities={[baseActivity]} subjects={subjects} />);
    await user.click(screen.getByText("Add Notes"));
    await user.type(screen.getByLabelText("Scribe's Notes"), "Finished the whole chapter");
    await user.click(screen.getByText("Save"));
    expect(updateActivity).toHaveBeenCalledWith("a1", {
      durationMinutes: 30,
      description: "Finished the whole chapter",
    });
  });

  it("seeds the editor with the existing notes", async () => {
    const user = userEvent.setup();
    const activity = { ...baseActivity, description: "Read pages 50-75" };
    render(<QuestLog activities={[activity]} subjects={subjects} />);
    await user.click(screen.getByText("Edit"));
    expect(screen.getByLabelText("Scribe's Notes")).toHaveValue("Read pages 50-75");
  });

  it("surfaces a rejected edit instead of silently closing the form", async () => {
    const user = userEvent.setup();
    vi.mocked(updateActivity).mockRejectedValueOnce(
      new Error("Scribe's Notes are required for this quest"),
    );
    const activity = { ...baseActivity, description: "Read pages 50-75" };
    render(<QuestLog activities={[activity]} subjects={subjects} />);
    await user.click(screen.getByText("Edit"));
    await user.clear(screen.getByLabelText("Scribe's Notes"));
    await user.click(screen.getByText("Save"));
    expect(
      await screen.findByText("Scribe's Notes are required for this quest"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Scribe's Notes")).toBeInTheDocument();
  });
});
