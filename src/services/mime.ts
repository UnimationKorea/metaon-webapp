const MIME_BY_EXTENSION: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  webm: "audio/webm",
  mp4: "video/mp4",
  m3u8: "application/vnd.apple.mpegurl",
  json: "application/json",
  xml: "application/xml",
  smi: "application/smil+xml",
  srt: "application/x-subrip",
  vtt: "text/vtt",
  txt: "text/plain"
};

export function guessMimeType(path: string): string {
  const extension = path.split(".").pop()?.toLowerCase() || "";
  return MIME_BY_EXTENSION[extension] || "application/octet-stream";
}
