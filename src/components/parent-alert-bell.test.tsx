import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ParentAlert } from "@/lib/actions/parent-alerts";

const dismiss = vi.fn().mockResolvedValue(undefined);
const dismissAll = vi.fn().mockResolvedValue(undefined);
let alerts: ParentAlert[] = [];

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/tavern"),
}));

vi.mock("@/components/parent-alerts-context", () => ({
  useParentAlerts: () => ({ alerts, busy: false, dismiss, dismissAll }),
}));

import { ParentAlertBell } from "./parent-alert-bell";

function alert(overrides: Partial<ParentAlert> = {}): ParentAlert {
  return {
    id: "a1",
    type: "quest_skipped",
    childId: "c1",
    childName: "Robin",
    questTitle: "Long division",
    subjectName: "Maths",
    date: "2026-08-26",
    note: null,
    createdAt: "2026-08-26T09:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  alerts = [];
  dismiss.mockClear();
  dismissAll.mockClear();
});
afterEach(cleanup);

describe("ParentAlertBell", () => {
  it("is mounted even with nothing waiting, so parents know where alerts live", () => {
    render(<ParentAlertBell />);
    expect(screen.getByText("Alerts")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /nothing needs your attention/i })).toBeInTheDocument();
  });

  it("carries no badge when there is nothing waiting", () => {
    const { container } = render(<ParentAlertBell />);
    expect(container.querySelector(".alert-medallion-badge")).toBeNull();
    expect(container.querySelector(".alert-medallion--unread")).toBeNull();
  });

  it("shows the unread count and goes loud when alerts are waiting", () => {
    alerts = [alert({ id: "a1" }), alert({ id: "a2" })];
    const { container } = render(<ParentAlertBell />);
    expect(container.querySelector(".alert-medallion-badge")).toHaveTextContent("2");
    expect(container.querySelector(".alert-medallion--unread")).not.toBeNull();
  });

  it("caps a runaway count rather than blowing out the medallion", () => {
    alerts = Array.from({ length: 120 }, (_, i) => alert({ id: `a${i}` }));
    const { container } = render(<ParentAlertBell />);
    expect(container.querySelector(".alert-medallion-badge")).toHaveTextContent("99+");
  });

  it("opens a tray listing what each hero skipped or got stuck on", async () => {
    const user = userEvent.setup();
    alerts = [
      alert({ id: "a1", type: "quest_skipped", questTitle: "Long division" }),
      alert({ id: "a2", type: "quest_stuck", childName: "Wren", questTitle: "Spelling" }),
    ];
    render(<ParentAlertBell />);

    await user.click(screen.getByRole("button", { name: /alerts need your attention/i }));

    const tray = screen.getByRole("dialog", { name: "Alerts" });
    expect(within(tray).getByText('Robin skipped "Long division"')).toBeInTheDocument();
    expect(within(tray).getByText('Wren got stuck on "Spelling"')).toBeInTheDocument();
  });

  it("dismisses a single alert from the tray", async () => {
    const user = userEvent.setup();
    alerts = [alert({ id: "a1" })];
    render(<ParentAlertBell />);

    await user.click(screen.getByRole("button", { name: /alert needs your attention/i }));
    await user.click(screen.getByRole("button", { name: /^Dismiss: Robin skipped/ }));

    expect(dismiss).toHaveBeenCalledWith("a1");
  });

  it("dismisses everything at once", async () => {
    const user = userEvent.setup();
    alerts = [alert({ id: "a1" }), alert({ id: "a2" })];
    render(<ParentAlertBell />);

    await user.click(screen.getByRole("button", { name: /alerts need your attention/i }));
    await user.click(screen.getByText("Dismiss all"));

    expect(dismissAll).toHaveBeenCalled();
  });

  it("keeps the overflow honest when there are more alerts than rows", async () => {
    const user = userEvent.setup();
    alerts = Array.from({ length: 9 }, (_, i) => alert({ id: `a${i}` }));
    render(<ParentAlertBell />);

    await user.click(screen.getByRole("button", { name: /alerts need your attention/i }));

    const tray = screen.getByRole("dialog", { name: "Alerts" });
    expect(within(tray).getAllByRole("listitem")).toHaveLength(6);
    expect(within(tray).getByText("View all 9 in the Tavern →")).toBeInTheDocument();
  });

  it("says so plainly when the tray is opened with nothing in it", async () => {
    const user = userEvent.setup();
    render(<ParentAlertBell />);

    await user.click(screen.getByRole("button", { name: /nothing needs your attention/i }));

    expect(screen.getByText(/All clear/)).toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    alerts = [alert({ id: "a1" })];
    render(<ParentAlertBell />);

    await user.click(screen.getByRole("button", { name: /alert needs your attention/i }));
    expect(screen.getByRole("dialog", { name: "Alerts" })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Alerts" })).not.toBeInTheDocument();
  });
});
