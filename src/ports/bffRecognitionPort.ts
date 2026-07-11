import type { RecognitionPort } from "../types/ports";

export const bffRecognitionPort: RecognitionPort = {
  async recognizeSpeech(audio, expectedText) {
    const form = new FormData();
    form.append("audio", audio, "recording.webm");
    if (expectedText) form.append("expectedText", expectedText);
    return postForm("/api/recognition/speech", form);
  },

  async recognizeHandwriting(image) {
    const form = new FormData();
    form.append("image", image, "canvas.png");
    return postForm("/api/recognition/handwriting", form);
  }
};

async function postForm(url: string, form: FormData): Promise<unknown> {
  const response = await fetch(url, {
    method: "POST",
    body: form
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.resultMessage || payload.message || "Recognition request failed");
  }
  return payload;
}
