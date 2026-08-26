import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ScheduleGapNotice } from "./schedule-gap-notice";
import type { SubjectScheduleGap } from "@/lib/utils/schedule-gaps";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const artGap: SubjectScheduleGap = {
  subjectId: "s-art",
  subjectName: "Art",
  missingDays: ["tue"],
  questTitles: ["Paint the Dragon Banner"],
  neverScheduled: true,
};

const mathGap: SubjectScheduleGap = {
  subjectId: "s-math",
  subjectName: "Math",
  missingDays: ["fri"],
  questTitles: ["Times Tables"],
  neverScheduled: false,
};

function renderNotice(gaps: SubjectScheduleGap[], props: Record<string, unknown> = {}) {
  return render(
    <ScheduleGapNotice
      heroes={[{ childId: "c1", childName: "Emma", gaps }]}
      dismissible
      {...props}
    />
  );
}

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe("ScheduleGapNotice dismissal", () => {
  it("shows the panel with a Dismiss control when dismissible", () => {
    renderNotice([artGap]);
    expect(screen.getByText("Quests with no class time")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dismiss" })).toBeInTheDocument();
  });

  it("hides the panel once dismissed", async () => {
    const user = userEvent.setup();
    renderNotice([artGap]);
    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText("Quests with no class time")).not.toBeInTheDocument();
  });

  it("stays dismissed across a remount", async () => {
    const user = userEvent.setup();
    renderNotice([artGap]);
    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    cleanup();

    renderNotice([artGap]);
    expect(screen.queryByText("Quests with no class time")).not.toBeInTheDocument();
  });

  it("comes back when a new gap appears", async () => {
    const user = userEvent.setup();
    renderNotice([artGap]);
    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    cleanup();

    // A second discipline has fallen off the schedule since — a different
    // warning, so acknowledging the first one must not bury it.
    renderNotice([artGap, mathGap]);
    expect(screen.getByText("Quests with no class time")).toBeInTheDocument();
  });

  it("comes back when an existing gap widens to another day", async () => {
    const user = userEvent.setup();
    renderNotice([artGap]);
    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    cleanup();

    renderNotice([{ ...artGap, missingDays: ["tue", "thu"] }]);
    expect(screen.getByText("Quests with no class time")).toBeInTheDocument();
  });

  it("stays dismissed when only the quests behind the gap change", async () => {
    const user = userEvent.setup();
    renderNotice([artGap]);
    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    cleanup();

    // Same discipline, same day — another quest joining it is the same warning.
    renderNotice([{ ...artGap, questTitles: ["Paint the Dragon Banner", "Sketch the Gate"] }]);
    expect(screen.queryByText("Quests with no class time")).not.toBeInTheDocument();
  });

  it("dismissing one hero's gaps doesn't bury another hero's", async () => {
    const user = userEvent.setup();
    render(
      <ScheduleGapNotice heroes={[{ childId: "c1", childName: "Emma", gaps: [artGap] }]} dismissible />
    );
    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    cleanup();

    render(
      <ScheduleGapNotice
        heroes={[
          { childId: "c1", childName: "Emma", gaps: [artGap] },
          { childId: "c2", childName: "Noah", gaps: [artGap] },
        ]}
        dismissible
      />
    );
    expect(screen.getByText("Quests with no class time")).toBeInTheDocument();
  });
});

describe("ScheduleGapNotice on the schedule page", () => {
  it("offers no Dismiss where the gap is meant to be fixed", () => {
    render(<ScheduleGapNotice heroes={[{ gaps: [artGap] }]} showFixLink={false} />);
    expect(screen.getByText("Quests with no class time")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Dismiss" })).not.toBeInTheDocument();
  });

  it("keeps showing even after the tavern copy was dismissed", async () => {
    const user = userEvent.setup();
    renderNotice([artGap]);
    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    cleanup();

    render(<ScheduleGapNotice heroes={[{ childId: "c1", gaps: [artGap] }]} showFixLink={false} />);
    expect(screen.getByText("Quests with no class time")).toBeInTheDocument();
  });

  it("renders nothing at all when there are no gaps", () => {
    const { container } = render(<ScheduleGapNotice heroes={[{ childId: "c1", gaps: [] }]} dismissible />);
    expect(container).toBeEmptyDOMElement();
  });
});
