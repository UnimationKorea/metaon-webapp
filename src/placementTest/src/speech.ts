// 브라우저 음성합성(Web Speech API)으로 듣기 문항을 읽어준다. 오디오 파일 불필요.
export function speak(text: string): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "en-US";
  utter.rate = 0.85; // 초등 저학년용으로 약간 천천히
  window.speechSynthesis.speak(utter);
}

export function isSpeechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}
