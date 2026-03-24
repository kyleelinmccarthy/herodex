import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { GameFrame } from "./game-frame";

afterEach(cleanup);

describe("GameFrame", () => {
  it("renders children", () => {
    render(<GameFrame>Hello World</GameFrame>);
    expect(screen.getByText("Hello World")).toBeInTheDocument();
  });

  it("renders title when provided", () => {
    render(<GameFrame title="My Panel">Content</GameFrame>);
    expect(screen.getByText("My Panel")).toBeInTheDocument();
  });

  it("does not render header when no title", () => {
    const { container } = render(<GameFrame>Content</GameFrame>);
    expect(container.querySelector(".game-frame-header")).toBeNull();
  });

  it("renders icon when provided with title", () => {
    render(<GameFrame title="Panel" icon="🏰">Content</GameFrame>);
    expect(screen.getByText("🏰")).toBeInTheDocument();
  });

  it("renders action slot when provided", () => {
    render(
      <GameFrame title="Panel" action={<button>View All</button>}>
        Content
      </GameFrame>,
    );
    expect(screen.getByText("View All")).toBeInTheDocument();
  });

  it("renders all 4 corner ornaments", () => {
    const { container } = render(<GameFrame>Content</GameFrame>);
    const corners = container.querySelectorAll("[data-corner]");
    expect(corners).toHaveLength(4);
  });

  it("applies custom className", () => {
    const { container } = render(<GameFrame className="stat-card">Content</GameFrame>);
    expect(container.firstElementChild).toHaveClass("game-frame", "stat-card");
  });
});
