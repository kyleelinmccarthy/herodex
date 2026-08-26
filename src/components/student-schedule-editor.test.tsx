import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StudentScheduleEditor } from "./student-schedule-editor";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const createScheduleBlock = vi.fn().mockResolvedValue({ id: "new" });
const updateScheduleBlock = vi.fn().mockResolvedValue(undefined);
const updateScheduleSlotTime = vi.fn().mockResolvedValue(undefined);
const deleteScheduleBlock = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/actions/student-schedule", () => ({
  createScheduleBlock: (...args: unknown[]) => createScheduleBlock(...args),
  updateScheduleBlock: (...args: unknown[]) => updateScheduleBlock(...args),
  updateScheduleSlotTime: (...args: unknown[]) => updateScheduleSlotTime(...args),
  deleteScheduleBlock: (...args: unknown[]) => deleteScheduleBlock(...args),
  copyScheduleBlocks: vi.fn(),
  setSchoolDays: vi.fn(),
  setStreakOptionalDay: vi.fn(),
}));

const subjects = [
  { id: "s-math", name: "Math", color: "#ef4444" },
  { id: "s-ela", name: "ELA", color: "#3b82f6" },
  { id: "s-writing", name: "Writing", color: "#22c55e" },
];

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

// ELA and Writing share the 07:40–09:00 period; Math has 09:10–10:20 to itself.
const blocks = [
  { id: "b-ela", subjectId: "s-ela", dayOfWeek: "mon", startTime: "07:40", endTime: "09:00" },
  { id: "b-writing", subjectId: "s-writing", dayOfWeek: "mon", startTime: "07:40", endTime: "09:00" },
  { id: "b-math", subjectId: "s-math", dayOfWeek: "mon", startTime: "09:10", endTime: "10:20" },
];

function renderEditor() {
  return render(
    <StudentScheduleEditor
      childId="c1"
      subjects={subjects}
      schoolDays={[...DAYS]}
      optionalDays={[]}
      blocks={blocks}
      canEdit={true}
    />
  );
}

/** Monday is only expanded when the suite happens to run on a Monday, so open every day. */
async function openDays(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByText("Expand All"));
}

/** The row for a period, found by the time it shows once. */
function slotRow(label: string) {
  return screen.getByText(label).closest("div.rounded-md") as HTMLElement;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("confirm", vi.fn(() => true));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("StudentScheduleEditor shared time slots", () => {
  it("puts subjects sharing a period on one row, with the time shown once", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openDays(user);

    // One row carries both subjects...
    const row = slotRow("7:40 AM–9:00 AM");
    expect(within(row).getByText("ELA")).toBeInTheDocument();
    expect(within(row).getByText("Writing")).toBeInTheDocument();

    // ...and the shared time is printed once for the day, not once per subject.
    expect(screen.getAllByText("7:40 AM–9:00 AM")).toHaveLength(1);
  });

  it("keeps a single-subject period on its own row", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openDays(user);

    const row = slotRow("9:10 AM–10:20 AM");
    expect(within(row).getByText("Math")).toBeInTheDocument();
    expect(within(row).queryByText("ELA")).not.toBeInTheDocument();
  });

  it("counts classes, not periods, in the day header", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openDays(user);
    expect(screen.getByText("(3 classes)")).toBeInTheDocument();
  });
});

describe("StudentScheduleEditor adding a subject to an existing period", () => {
  it("asks only for the subject — the time comes from the period it joins", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openDays(user);

    await user.click(
      screen.getByLabelText("Add a subject to the 9:10 AM slot on Monday")
    );
    expect(screen.getByText("Also in this slot")).toBeInTheDocument();
    // No time inputs in this form — nothing to re-type.
    const form = screen.getByLabelText("Subject to add to the 9:10 AM slot on Monday")
      .closest("div") as HTMLElement;
    expect(within(form).queryByLabelText("Start")).not.toBeInTheDocument();
  });

  it("only offers subjects that aren't already in the period", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openDays(user);

    await user.click(
      screen.getByLabelText("Add a subject to the 7:40 AM slot on Monday")
    );
    const select = screen.getByLabelText("Subject to add to the 7:40 AM slot on Monday");
    const options = within(select).getAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual(["Math"]);
  });

  it("adds at the period's own times, without a confirmation", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openDays(user);

    await user.click(
      screen.getByLabelText("Add a subject to the 9:10 AM slot on Monday")
    );
    await user.selectOptions(
      screen.getByLabelText("Subject to add to the 9:10 AM slot on Monday"),
      "s-ela"
    );
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(createScheduleBlock).toHaveBeenCalledWith("c1", {
      subjectId: "s-ela",
      dayOfWeek: "mon",
      startTime: "09:10",
      endTime: "10:20",
    });
    expect(window.confirm).not.toHaveBeenCalled();
  });

  it("says so when every subject is already in the period", async () => {
    const user = userEvent.setup();
    render(
      <StudentScheduleEditor
        childId="c1"
        subjects={subjects}
        schoolDays={[...DAYS]}
        optionalDays={[]}
        blocks={[
          ...blocks,
          { id: "b-math2", subjectId: "s-math", dayOfWeek: "mon", startTime: "07:40", endTime: "09:00" },
        ]}
        canEdit={true}
      />
    );
    await openDays(user);
    await user.click(
      screen.getByLabelText("Add a subject to the 7:40 AM slot on Monday")
    );
    expect(screen.getByText("Every discipline is already in this slot.")).toBeInTheDocument();
  });
});

describe("StudentScheduleEditor retiming a period", () => {
  it("moves every subject in a shared period together", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openDays(user);

    await user.click(screen.getByLabelText("Edit the 7:40 AM slot on Monday"));
    expect(screen.getByText("Moving this slot moves all 2 disciplines in it together.")).toBeInTheDocument();

    await user.clear(screen.getByLabelText("Start"));
    await user.type(screen.getByLabelText("Start"), "08:00");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(updateScheduleSlotTime).toHaveBeenCalledWith(
      "c1",
      "mon",
      expect.objectContaining({ startTime: "07:40", endTime: "09:00" }),
      { startTime: "08:00", endTime: "09:00" }
    );
    // A shared period must never be moved a block at a time — the halves would
    // partially overlap each other mid-move and the second update would reject.
    expect(updateScheduleBlock).not.toHaveBeenCalled();
  });

  it("still lets a solo period change its subject", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openDays(user);

    await user.click(screen.getByLabelText("Edit the 9:10 AM slot on Monday"));
    await user.selectOptions(screen.getByLabelText("Subject"), "s-ela");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(updateScheduleBlock).toHaveBeenCalledWith("b-math", {
      subjectId: "s-ela",
      startTime: "09:10",
      endTime: "10:20",
    });
  });

  it("refuses a move that would half-cover another period", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openDays(user);

    await user.click(screen.getByLabelText("Edit the 9:10 AM slot on Monday"));
    await user.clear(screen.getByLabelText("Start"));
    await user.type(screen.getByLabelText("Start"), "08:30");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByText(/overlaps part of/i)).toBeInTheDocument();
    expect(updateScheduleBlock).not.toHaveBeenCalled();
    expect(updateScheduleSlotTime).not.toHaveBeenCalled();
  });
});

describe("StudentScheduleEditor removing", () => {
  it("removes one subject from a shared period, leaving the rest", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openDays(user);

    await user.click(
      screen.getByLabelText("Remove Writing from the 7:40 AM slot on Monday")
    );
    expect(deleteScheduleBlock).toHaveBeenCalledWith("b-writing");
    expect(deleteScheduleBlock).toHaveBeenCalledTimes(1);
  });

  it("offers no per-subject remove on a solo period — the row's own × is that", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openDays(user);

    expect(
      screen.queryByLabelText("Remove Math from the 9:10 AM slot on Monday")
    ).not.toBeInTheDocument();
    await user.click(screen.getByLabelText("Remove the 9:10 AM slot from Monday"));
    expect(deleteScheduleBlock).toHaveBeenCalledWith("b-math");
  });

  it("clears a whole shared period at once", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openDays(user);

    await user.click(screen.getByLabelText("Remove the 7:40 AM slot from Monday"));
    expect(deleteScheduleBlock).toHaveBeenCalledWith("b-ela");
    expect(deleteScheduleBlock).toHaveBeenCalledWith("b-writing");
  });
});
