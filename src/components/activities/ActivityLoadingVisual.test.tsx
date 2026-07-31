import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ActivityLoadingVisual } from "./ActivityLoadingVisual";

describe("ActivityLoadingVisual", () => {
  it("renders only the book and independently animated orbit layers", () => {
    const { container } = render(<ActivityLoadingVisual className="activity-resource-loading" />);

    expect(screen.getByRole("status", { name: "Loading activity" })).toHaveClass("activity-resource-loading");
    expect(container.querySelector(".activity-loading-visual-book")).toHaveAttribute(
      "src",
      "/metaon-assets/activity/loading/loading-book.png"
    );
    expect(container.querySelector(".activity-loading-visual-orbit")).toHaveAttribute(
      "src",
      "/metaon-assets/activity/loading/loading-star-orbit.png"
    );
    expect(container.querySelector(".activity-loading-visual-art")).not.toBeInTheDocument();
  });
});
