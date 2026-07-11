import type { MediaPort } from "../types/ports";

export const browserMediaPort: MediaPort = {
  async playAudioUrl(url) {
    const audio = new Audio(url);
    await audio.play();
  },
  createObjectUrl(blob) {
    return URL.createObjectURL(blob);
  },
  revokeObjectUrl(url) {
    URL.revokeObjectURL(url);
  }
};
