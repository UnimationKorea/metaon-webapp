import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ActivityCompletionCelebration } from "./ActivityCompletionCelebration";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("ActivityCompletionCelebration", () => {
  it("shows the awarded points and reward copy on first study", () => {
    render(<ActivityCompletionCelebration firstStudy points={12} onDone={() => {}} />);
    expect(screen.getByText("+12")).toBeInTheDocument();
    expect(screen.getByText("포인트 획득!")).toBeInTheDocument();
  });

  it("celebrates without a points number when none was awarded", () => {
    render(<ActivityCompletionCelebration firstStudy onDone={() => {}} />);
    expect(screen.queryByText(/^\+/)).toBeNull();
    expect(screen.getByText("포인트 획득!")).toBeInTheDocument();
  });

  it("shows review copy when the activity was already completed", () => {
    render(<ActivityCompletionCelebration firstStudy={false} onDone={() => {}} />);
    expect(screen.getByText("복습 완료!")).toBeInTheDocument();
  });

  it("calls onDone once on click", () => {
    const onDone = vi.fn();
    render(<ActivityCompletionCelebration firstStudy onDone={onDone} />);
    const overlay = screen.getByRole("alertdialog");
    fireEvent.click(overlay);
    fireEvent.click(overlay);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("auto-dismisses after the timeout", () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    render(<ActivityCompletionCelebration firstStudy points={5} onDone={onDone} />);
    expect(onDone).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2000);
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
