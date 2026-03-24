import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { GameBanner, GameNavBar } from "./game-nav";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/tavern"),
}));

vi.mock("@/components/user-menu", () => ({
  UserMenu: ({ userName }: { userName: string }) => (
    <div data-testid="user-menu">{userName}</div>
  ),
}));

afterEach(cleanup);

describe("GameBanner", () => {
  it("renders the HeroDex brand", () => {
    render(<GameBanner />);
    expect(screen.getByText("HeroDex")).toBeInTheDocument();
  });

  it("renders the crown logo", () => {
    const { container } = render(<GameBanner />);
    const logo = container.querySelector("img.game-banner-logo");
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute("src", "/crown.svg");
  });

  it("links to tavern", () => {
    render(<GameBanner />);
    const link = screen.getByText("HeroDex").closest("a");
    expect(link).toHaveAttribute("href", "/tavern");
  });

});

describe("GameNavBar", () => {
  it("renders all navigation items", () => {
    render(<GameNavBar userName="Test User" />);
    expect(screen.getByText("Tavern")).toBeInTheDocument();
    expect(screen.getByText("Quest Log")).toBeInTheDocument();
    expect(screen.getByText("Loot")).toBeInTheDocument();
    expect(screen.getByText("Ranks")).toBeInTheDocument();
  });

  it("renders user menu with userName", () => {
    render(<GameNavBar userName="Jane Doe" />);
    expect(screen.getByTestId("user-menu")).toHaveTextContent("Jane Doe");
  });

  it("highlights active route", () => {
    render(<GameNavBar userName="Test" />);
    const tavernLink = screen.getByText("Tavern").closest("a");
    expect(tavernLink).toHaveClass("medallion--active");
  });

  it("does not highlight inactive routes", () => {
    render(<GameNavBar userName="Test" />);
    const questsLink = screen.getByText("Quest Log").closest("a");
    expect(questsLink).not.toHaveClass("medallion--active");
  });

  it("renders corner ornaments on navbar", () => {
    const { container } = render(<GameNavBar userName="Test" />);
    const corners = container.querySelectorAll("[class*='game-navbar-corner']");
    expect(corners).toHaveLength(4);
  });
});
