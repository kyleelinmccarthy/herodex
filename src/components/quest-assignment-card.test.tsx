import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QuestAssignmentCard } from "./quest-assignment-card";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/lib/actions/quest-assignments", () => ({
  completeAssignment: vi.fn().mockResolvedValue({ activityId: "a1" }),
  skipAssignment: vi.fn().mockResolvedValue(undefined),
  updateAssignmentNotes: vi.fn().mockResolvedValue(undefined),
}));

import { skipAssignment, updateAssignmentNotes } from "@/lib/actions/quest-assignments";

vi.mock("@/hooks/use-quest-timer", () => ({
  useQuestTimer: () => mockTimerHook,
  formatElapsed: (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  },
}));

let mockTimerHook: {
  activeTimer: { assignmentId: string; startedAt: number } | null;
  elapsedSeconds: number;
  startTimer: ReturnType<typeof vi.fn>;
  stopTimer: ReturnType<typeof vi.fn>;
  cancelTimer: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  vi.mocked(skipAssignment).mockClear();
  vi.mocked(updateAssignmentNotes).mockClear();
  mockTimerHook = {
    activeTimer: null,
    elapsedSeconds: 0,
    startTimer: vi.fn(),
    stopTimer: vi.fn().mockReturnValue({
      startedAt: new Date(),
      endedAt: new Date(),
      durationMinutes: 5,
    }),
    cancelTimer: vi.fn(),
  };
});

afterEach(cleanup);

const baseData = {
  assignment: { id: "qa1", status: "pending", notes: null },
  quest: { id: "q1", title: "Read Chapter 5", description: "Pages 50-75", estimatedMinutes: 30, rewardXp: null, rewardDescription: null, rewardAvatarItem: null, requireNotes: false },
  subject: { id: "s1", name: "Math", color: "#ef4444" },
};

describe("QuestAssignmentCard", () => {
  it("renders quest title and details for pending assignment", () => {
    render(<QuestAssignmentCard data={baseData} isChildView={false} />);
    expect(screen.getByText("Read Chapter 5")).toBeInTheDocument();
    expect(screen.getByText("Pages 50-75")).toBeInTheDocument();
    expect(screen.getByText("~30min")).toBeInTheDocument();
  });

  it("shows Mark Done and Skip buttons for parent view", () => {
    render(<QuestAssignmentCard data={baseData} isChildView={false} />);
    expect(screen.getByText("Mark Done")).toBeInTheDocument();
    expect(screen.getByText("Skip")).toBeInTheDocument();
  });

  it("shows Start and Quick Complete buttons for child view", () => {
    render(<QuestAssignmentCard data={baseData} isChildView={true} />);
    expect(screen.getByText("Start")).toBeInTheDocument();
    expect(screen.getByText("Quick Complete")).toBeInTheDocument();
  });

  it("shows timer display when timer is running", () => {
    mockTimerHook.activeTimer = { assignmentId: "qa1", startedAt: Date.now() - 125000 };
    mockTimerHook.elapsedSeconds = 125;
    render(<QuestAssignmentCard data={baseData} isChildView={true} />);
    expect(screen.getByText("02:05")).toBeInTheDocument();
    expect(screen.getByText("Stop")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("calls startTimer when Start is clicked", async () => {
    const user = userEvent.setup();
    render(<QuestAssignmentCard data={baseData} isChildView={true} />);
    await user.click(screen.getByText("Start"));
    expect(mockTimerHook.startTimer).toHaveBeenCalledWith("qa1");
  });

  it("disables Start button when another timer is active", () => {
    mockTimerHook.activeTimer = { assignmentId: "other-assignment", startedAt: Date.now() };
    render(<QuestAssignmentCard data={baseData} isChildView={true} />);
    expect(screen.getByText("Start")).toBeDisabled();
  });

  it("shows quick complete duration input when Quick Complete is clicked", async () => {
    const user = userEvent.setup();
    render(<QuestAssignmentCard data={baseData} isChildView={true} />);
    await user.click(screen.getByText("Quick Complete"));
    expect(screen.getByLabelText("Duration in minutes")).toBeInTheDocument();
    expect(screen.getByText("Submit")).toBeInTheDocument();
  });

  it("offers a Scribe's Notes field on quick complete even when notes are optional", async () => {
    const user = userEvent.setup();
    render(<QuestAssignmentCard data={baseData} isChildView={true} />);
    await user.click(screen.getByText("Quick Complete"));
    const notes = screen.getByLabelText("Scribe's Notes");
    expect(notes).toBeInTheDocument();
    expect(notes).toHaveAttribute("placeholder", expect.stringContaining("(optional)"));
    // Optional notes must not block submitting.
    expect(screen.getByText("Submit")).not.toBeDisabled();
  });

  it("requires Scribe's Notes before submitting when the quest demands them", async () => {
    const user = userEvent.setup();
    const data = { ...baseData, quest: { ...baseData.quest, requireNotes: true } };
    render(<QuestAssignmentCard data={data} isChildView={true} />);
    await user.click(screen.getByText("Quick Complete"));
    expect(screen.getByLabelText("Scribe's Notes")).toHaveAttribute(
      "placeholder",
      expect.stringContaining("(required)"),
    );
    expect(screen.getByText("Submit")).toBeDisabled();
    await user.type(screen.getByLabelText("Scribe's Notes"), "Read pages 50-75");
    expect(screen.getByText("Submit")).not.toBeDisabled();
  });

  it("locks a hero out of quests that are not next in structured mode", () => {
    render(
      <QuestAssignmentCard
        data={baseData}
        isChildView={true}
        structuredNext={{ id: "other-quest", title: "Math Drills" }}
      />
    );
    expect(screen.getByText('Complete "Math Drills" first')).toBeInTheDocument();
    expect(screen.queryByText("Start")).not.toBeInTheDocument();
    expect(screen.queryByText("Quick Complete")).not.toBeInTheDocument();
  });

  it("leaves the quest that is next in structured mode fully actionable", () => {
    render(
      <QuestAssignmentCard
        data={baseData}
        isChildView={true}
        structuredNext={{ id: "q1", title: "Read Chapter 5" }}
      />
    );
    expect(screen.getByText("Start")).toBeInTheDocument();
    expect(screen.getByText("Quick Complete")).toBeInTheDocument();
  });

  it("hides Skip from a hero whose parent has not allowed it", () => {
    render(<QuestAssignmentCard data={baseData} isChildView={true} />);
    expect(screen.queryByText("Skip")).not.toBeInTheDocument();
  });

  it("lets a hero skip with a reason once a parent allows it", async () => {
    const user = userEvent.setup();
    render(<QuestAssignmentCard data={baseData} isChildView={true} allowChildSkip={true} />);
    await user.click(screen.getByText("Skip"));
    await user.type(screen.getByLabelText("Reason for skipping"), "Too hard today");
    expect(screen.getByText("Your grown-up will be told.")).toBeInTheDocument();
    await user.click(screen.getByText("Skip Quest"));
    expect(skipAssignment).toHaveBeenCalledWith("qa1", "Too hard today");
  });

  it("still hides Skip from a hero on a quest that is not their turn", () => {
    render(
      <QuestAssignmentCard
        data={baseData}
        isChildView={true}
        allowChildSkip={true}
        structuredNext={{ id: "other-quest", title: "Math Drills" }}
      />
    );
    expect(screen.queryByText("Skip")).not.toBeInTheDocument();
  });

  it("skips straight away for a parent, with no reason prompt", async () => {
    const user = userEvent.setup();
    render(<QuestAssignmentCard data={baseData} isChildView={false} />);
    await user.click(screen.getByText("Skip"));
    expect(skipAssignment).toHaveBeenCalledWith("qa1", undefined);
  });

  it("shows completed state", () => {
    const data = {
      ...baseData,
      assignment: { ...baseData.assignment, status: "completed" },
    };
    render(<QuestAssignmentCard data={data} isChildView={false} />);
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.queryByText("Mark Done")).not.toBeInTheDocument();
  });

  it("offers Add Notes on a completed quest that has none yet", () => {
    const data = {
      ...baseData,
      assignment: { ...baseData.assignment, status: "completed" },
    };
    render(<QuestAssignmentCard data={data} isChildView={true} />);
    expect(screen.getByText("Add Notes")).toBeInTheDocument();
  });

  it("shows a completed quest's notes and offers to edit them", () => {
    const data = {
      ...baseData,
      assignment: { ...baseData.assignment, status: "completed", notes: "Read pages 50-75" },
    };
    render(<QuestAssignmentCard data={data} isChildView={true} />);
    expect(screen.getByText("Read pages 50-75")).toBeInTheDocument();
    expect(screen.getByText("Edit Notes")).toBeInTheDocument();
    expect(screen.queryByText("Add Notes")).not.toBeInTheDocument();
  });

  it("lets a hero write notes onto an already-completed quest", async () => {
    const user = userEvent.setup();
    const data = {
      ...baseData,
      assignment: { ...baseData.assignment, status: "completed" },
    };
    render(<QuestAssignmentCard data={data} isChildView={true} />);
    await user.click(screen.getByText("Add Notes"));
    await user.type(screen.getByLabelText("Scribe's Notes"), "Finished the whole chapter");
    await user.click(screen.getByText("Save Notes"));
    expect(updateAssignmentNotes).toHaveBeenCalledWith("qa1", "Finished the whole chapter");
  });

  it("seeds the notes editor with the notes already on the quest", async () => {
    const user = userEvent.setup();
    const data = {
      ...baseData,
      assignment: { ...baseData.assignment, status: "completed", notes: "Read pages 50-75" },
    };
    render(<QuestAssignmentCard data={data} isChildView={true} />);
    await user.click(screen.getByText("Edit Notes"));
    expect(screen.getByLabelText("Scribe's Notes")).toHaveValue("Read pages 50-75");
  });

  it("will not let a required-notes quest be left blank by an edit", async () => {
    const user = userEvent.setup();
    const data = {
      ...baseData,
      assignment: { ...baseData.assignment, status: "completed", notes: "Read pages 50-75" },
      quest: { ...baseData.quest, requireNotes: true },
    };
    render(<QuestAssignmentCard data={data} isChildView={true} />);
    await user.click(screen.getByText("Edit Notes"));
    await user.clear(screen.getByLabelText("Scribe's Notes"));
    expect(screen.getByText("Save Notes")).toBeDisabled();
    expect(updateAssignmentNotes).not.toHaveBeenCalled();
  });

  it("keeps notes editing off a pending quest — completing it is how notes get written", () => {
    render(<QuestAssignmentCard data={baseData} isChildView={true} />);
    expect(screen.queryByText("Add Notes")).not.toBeInTheDocument();
    expect(screen.queryByText("Edit Notes")).not.toBeInTheDocument();
  });

  it("shows skipped state with notes", () => {
    const data = {
      ...baseData,
      assignment: { ...baseData.assignment, status: "skipped", notes: "Sick day" },
    };
    render(<QuestAssignmentCard data={data} isChildView={false} />);
    expect(screen.getByText("Skipped: Sick day")).toBeInTheDocument();
    expect(screen.queryByText("Mark Done")).not.toBeInTheDocument();
  });

  it("renders subject color dot", () => {
    const { container } = render(<QuestAssignmentCard data={baseData} isChildView={false} />);
    const dot = container.querySelector(".rounded-full");
    expect(dot).toHaveStyle({ backgroundColor: "#ef4444" });
  });
});
