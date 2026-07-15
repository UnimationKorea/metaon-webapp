import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProgressMeter } from "./ProgressMeter";

describe("ProgressMeter", () => {
  it("shows only a generic progress label and percent without resource paths", () => {
    render(
      <ProgressMeter
        progress={{
          phase: "downloading",
          ratio: 0.42,
          currentFile: "Lessons/L1/D1/ebook/assets/pages/page_001.png",
          message: "Using cached resource"
        }}
      />
    );

    const meter = screen.getByRole("progressbar", { name: "Book 리소스 다운로드 중" });
    expect(meter).toHaveAttribute("aria-valuenow", "42");
    expect(screen.getByText("42%")).toBeInTheDocument();
    expect(screen.queryByText(/page_001\.png|Using cached resource/)).not.toBeInTheDocument();
  });

  it("supports a cache-check label without exposing progress metadata", () => {
    render(
      <ProgressMeter
        label="저장된 Book 리소스 확인 중"
        progress={{ phase: "downloading", ratio: 0, currentFile: "hidden/resource.mp3" }}
      />
    );

    expect(screen.getByRole("progressbar", { name: "저장된 Book 리소스 확인 중" })).toHaveAttribute("aria-valuenow", "0");
    expect(screen.queryByText("hidden/resource.mp3")).not.toBeInTheDocument();
  });
});
