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
}));

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
  quest: { id: "q1", title: "Read Chapter 5", description: "Pages 50-75", estimatedMinutes: 30, rewardXp: null, rewardDescription: null, rewardAvatarItem: null },
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

  it("shows completed state", () => {
    const data = {
      ...baseData,
      assignment: { ...baseData.assignment, status: "completed" },
    };
    render(<QuestAssignmentCard data={data} isChildView={false} />);
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.queryByText("Mark Done")).not.toBeInTheDocument();
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
