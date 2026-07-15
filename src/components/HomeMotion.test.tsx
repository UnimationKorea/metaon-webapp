import { fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HomeDepthScene, HomeMotionRoot } from "./HomeMotion";

describe("HomeMotion", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders a theme-aware depth scene without changing its children", () => {
    mockReducedMotion(false);

    const { container } = render(
      <HomeMotionRoot themeId="undersea">
        <HomeDepthScene themeId="undersea" />
        <a href="/study">스터디존</a>
      </HomeMotionRoot>
    );

    const root = container.querySelector<HTMLElement>(".hub-home-motion-root");
    expect(root).toHaveAttribute("data-home-theme", "undersea");
    expect(root).toHaveAttribute("data-home-motion-quality", "full");
    expect(container.querySelectorAll(".hub-theme-particle")).toHaveLength(12);
    expect(container.querySelectorAll(".hub-theme-particle img")).toHaveLength(12);
    expect(container.querySelector(".hub-home-depth-scene")).toHaveAttribute("data-particle-kind", "bubble");
    expect(container.querySelector("a")).toHaveAttribute("href", "/study");
  });

  it("honors the operating system reduced-motion preference", () => {
    mockReducedMotion(true);

    const { container } = render(
      <HomeMotionRoot themeId="space">
        <HomeDepthScene themeId="space" />
      </HomeMotionRoot>
    );

    expect(container.querySelector(".hub-home-motion-root")).toHaveAttribute("data-home-motion-quality", "reduced");
    expect(container.querySelector(".hub-home-depth-scene")).toHaveAttribute("data-particle-kind", "spark");
  });

  it("applies card-relative tilt variables and resets them outside the surface", () => {
    mockReducedMotion(false);

    const { container } = render(
      <HomeMotionRoot themeId="space">
        <button data-home-tilt="portal" type="button">
          Open portal
        </button>
      </HomeMotionRoot>
    );

    const root = container.querySelector<HTMLElement>(".hub-home-motion-root");
    const surface = container.querySelector<HTMLElement>("[data-home-tilt]");
    expect(root).not.toBeNull();
    expect(surface).not.toBeNull();

    Object.defineProperty(root, "getBoundingClientRect", { configurable: true, value: () => rect(0, 0, 400, 240) });
    Object.defineProperty(surface, "getBoundingClientRect", { configurable: true, value: () => rect(10, 10, 200, 100) });

    fireEvent(surface!, pointerMove(190, 15));
    expect(surface).toHaveAttribute("data-tilt-active", "true");
    expect(surface!.style.getPropertyValue("--hub-local-tilt-x")).toBe("4.680deg");
    expect(surface!.style.getPropertyValue("--hub-local-tilt-y")).toBe("4.160deg");

    fireEvent(root!, pointerMove(390, 220));
    expect(surface).not.toHaveAttribute("data-tilt-active");
    expect(surface!.style.getPropertyValue("--hub-local-tilt-x")).toBe("0deg");
    expect(surface!.style.getPropertyValue("--hub-local-tilt-y")).toBe("0deg");
  });
});

function rect(x: number, y: number, width: number, height: number): DOMRect {
  return {
    bottom: y + height,
    height,
    left: x,
    right: x + width,
    top: y,
    width,
    x,
    y,
    toJSON: () => ({})
  } as DOMRect;
}

function pointerMove(clientX: number, clientY: number) {
  const event = new MouseEvent("pointermove", { bubbles: true, clientX, clientY });
  Object.defineProperty(event, "pointerType", { value: "mouse" });
  return event;
}

function mockReducedMotion(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      addEventListener: vi.fn(),
      addListener: vi.fn(),
      dispatchEvent: vi.fn(),
      matches: query === "(prefers-reduced-motion: reduce)" ? matches : false,
      media: query,
      onchange: null,
      removeEventListener: vi.fn(),
      removeListener: vi.fn()
    }))
  });
}
