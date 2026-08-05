import type { RecognitionPort } from "../types/ports";

export const bffRecognitionPort: RecognitionPort = {
  async recognizeSpeech(audio, expectedText) {
    const form = new FormData();
    form.append("audio", audio, "recording.webm");
    if (expectedText) form.append("expectedText", expectedText);
    return postForm("/api/recognition/speech", form);
  },

  async recognizeHandwriting(image) {
    const imageBase64 = await blobToBase64(image);
    return postJson("/api/recognition/handwriting", { imageBase64 }) as ReturnType<RecognitionPort["recognizeHandwriting"]>;
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

async function postJson(url: string, body: unknown): Promise<unknown> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.resultMessage || payload.message || payload.detail || "Recognition request failed");
  }
  return payload;
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const chunkSize = 0x8000;
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}
