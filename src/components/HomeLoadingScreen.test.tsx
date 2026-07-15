import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HomeLoadingScreen } from "./HomeLoadingScreen";

describe("HomeLoadingScreen", () => {
  it("shows a visual-only branded loading state with an accessible status", () => {
    const { container } = render(
      <HomeLoadingScreen
        backgroundImage="/metaon-assets/hero-themes/hero-space.png"
        backgroundPosition="center"
        themeId="space"
      />
    );

    const status = screen.getByRole("status", { name: "MetaOn 홈 화면을 준비하고 있습니다" });
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(status).toHaveAttribute("data-loading-theme", "space");
    expect(status.style.getPropertyValue("--hub-home-loading-position")).toBe("center");
    expect(container.querySelector(".hub-home-loading-backdrop")).toHaveAttribute(
      "src",
      "/metaon-assets/hero-themes/hero-space.png"
    );
    expect(container.querySelector(".hub-home-loading-icon-stage img")).toHaveAttribute(
      "src",
      "/unity-app-ui/brand/app-icon.png"
    );
    expect(screen.queryByText(/Loading home|Fetching MetaOn catalog/i)).not.toBeInTheDocument();
  });
});
