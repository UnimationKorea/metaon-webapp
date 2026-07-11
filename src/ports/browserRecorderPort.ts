import type { RecorderPort } from "../types/ports";

class BrowserRecorderPort implements RecorderPort {
  private mediaRecorder?: MediaRecorder;
  private chunks: BlobPart[] = [];

  async requestPermission(): Promise<boolean> {
    if (!navigator.mediaDevices?.getUserMedia) return false;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    return true;
  }

  async start(): Promise<void> {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.chunks = [];
    this.mediaRecorder = new MediaRecorder(stream);
    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.chunks.push(event.data);
      }
    };
    this.mediaRecorder.start();
  }

  async stop(): Promise<Blob | undefined> {
    const recorder = this.mediaRecorder;
    if (!recorder || recorder.state === "inactive") return undefined;

    const stopped = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
    });
    recorder.stop();
    recorder.stream.getTracks().forEach((track) => track.stop());
    await stopped;
    this.mediaRecorder = undefined;
    return new Blob(this.chunks, { type: recorder.mimeType || "audio/webm" });
  }

  isRecording(): boolean {
    return this.mediaRecorder?.state === "recording";
  }
}

export const browserRecorderPort = new BrowserRecorderPort();
