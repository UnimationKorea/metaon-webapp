import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ActivityTopBar } from "./ActivityTopBar";

describe("ActivityTopBar", () => {
  it("returns to the Book through the SPA callback instead of an anchor navigation", () => {
    const onBack = vi.fn();

    render(
      <ActivityTopBar
        isFirstActivity
        isFullscreen={false}
        isLastActivity={false}
        onBack={onBack}
        onNext={vi.fn()}
        onPrev={vi.fn()}
        onToggleFullscreen={vi.fn()}
      />
    );

    expect(screen.queryByRole("link", { name: "Back to book" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back to book" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
