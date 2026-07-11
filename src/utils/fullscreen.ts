export function isFullscreenSupported(): boolean {
  return typeof document !== "undefined" && Boolean(document.fullscreenEnabled && document.documentElement.requestFullscreen);
}

export function isDocumentFullscreen(): boolean {
  return typeof document !== "undefined" && Boolean(document.fullscreenElement);
}

export async function requestFullscreen(element: HTMLElement = document.documentElement): Promise<boolean> {
  if (!isFullscreenSupported()) return false;

  try {
    if (!document.fullscreenElement) {
      await element.requestFullscreen();
    }
    return true;
  } catch {
    return false;
  }
}

export async function exitFullscreen(): Promise<boolean> {
  if (typeof document === "undefined" || !document.fullscreenElement) return false;

  try {
    await document.exitFullscreen();
    return true;
  } catch {
    return false;
  }
}
