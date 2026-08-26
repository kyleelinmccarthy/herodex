import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ParentAlert } from "@/lib/actions/parent-alerts";

const dismiss = vi.fn().mockResolvedValue(undefined);
const dismissAll = vi.fn().mockResolvedValue(undefined);
let alerts: ParentAlert[] = [];

vi.mock("@/components/parent-alerts-context", () => ({
  useParentAlerts: () => ({ alerts, busy: false, dismiss, dismissAll }),
}));

import { ParentAlertsPanel, ParentAlertPopup } from "./parent-alerts";

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

describe("ParentAlertsPanel", () => {
  it("stays out of the way when there is nothing to report", () => {
    const { container } = render(<ParentAlertsPanel />);
    expect(container).toBeEmptyDOMElement();
  });

  it("counts the alerts in its own title", () => {
    alerts = [alert({ id: "a1" }), alert({ id: "a2" })];
    render(<ParentAlertsPanel />);
    expect(screen.getByText("Alerts (2)")).toBeInTheDocument();
  });

  it("phrases each alert by its type", () => {
    alerts = [
      alert({ id: "a1", type: "quest_skipped" }),
      alert({ id: "a2", type: "quest_stuck", childName: "Wren", questTitle: "Spelling" }),
    ];
    render(<ParentAlertsPanel />);
    expect(screen.getByText("skipped", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("got stuck on", { exact: false })).toBeInTheDocument();
  });

  it("shows the hero's own reason when they gave one", () => {
    alerts = [alert({ note: "It was too hard today" })];
    render(<ParentAlertsPanel />);
    expect(screen.getByText(/It was too hard today/)).toBeInTheDocument();
  });

  it("dismisses one, and dismisses all", async () => {
    const user = userEvent.setup();
    alerts = [alert({ id: "a1" }), alert({ id: "a2" })];
    render(<ParentAlertsPanel />);

    await user.click(screen.getAllByRole("button", { name: "Dismiss" })[0]);
    expect(dismiss).toHaveBeenCalledWith("a1");

    await user.click(screen.getByRole("button", { name: "Dismiss all" }));
    expect(dismissAll).toHaveBeenCalled();
  });
});

describe("ParentAlertPopup", () => {
  it("leaves what was already waiting to the bell rather than restacking cards", () => {
    alerts = [alert({ id: "a1" })];
    const { container } = render(<ParentAlertPopup />);
    expect(container).toBeEmptyDOMElement();
  });

  it("raises a card for an alert that arrives while the app is open", () => {
    alerts = [];
    const { rerender } = render(<ParentAlertPopup />);

    alerts = [alert({ id: "a1", type: "quest_stuck" })];
    rerender(<ParentAlertPopup />);

    expect(screen.getByText('Robin got stuck on "Long division"')).toBeInTheDocument();
  });

  it("closes the card without clearing the alert itself", async () => {
    const user = userEvent.setup();
    alerts = [];
    const { rerender } = render(<ParentAlertPopup />);
    alerts = [alert({ id: "a1" })];
    rerender(<ParentAlertPopup />);

    await user.click(screen.getByRole("button", { name: "Close notification" }));

    expect(screen.queryByText('Robin skipped "Long division"')).not.toBeInTheDocument();
    expect(dismiss).not.toHaveBeenCalled();
  });

  it("drops a card once its alert has been dealt with elsewhere", () => {
    alerts = [];
    const { rerender, container } = render(<ParentAlertPopup />);
    alerts = [alert({ id: "a1" })];
    rerender(<ParentAlertPopup />);
    expect(screen.getByText('Robin skipped "Long division"')).toBeInTheDocument();

    alerts = [];
    rerender(<ParentAlertPopup />);
    expect(container).toBeEmptyDOMElement();
  });
});
