import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppLoadingScreen } from "./AppLoadingScreen";

describe("AppLoadingScreen", () => {
  it("uses the shared book and rotating star-orbit visual without loading copy", () => {
    const { container } = render(<AppLoadingScreen />);

    expect(screen.getByRole("status", { name: "MetaOn 화면을 준비하고 있습니다" })).toHaveClass("app-loading-screen");
    expect(container.querySelector(".activity-loading-visual-book")).toHaveAttribute(
      "src",
      "/metaon-assets/activity/loading/loading-book.png"
    );
    expect(container.querySelector(".activity-loading-visual-orbit")).toHaveAttribute(
      "src",
      "/metaon-assets/activity/loading/loading-star-orbit.png"
    );
    expect(screen.queryByText(/loading|preparing/i)).not.toBeInTheDocument();
  });
});
