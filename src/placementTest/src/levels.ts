import type { SectionId } from "./types";

// 영역 한글 라벨 + 이모지
export const SECTION_META: Record<SectionId, { label: string; emoji: string }> = {
  vocabulary: { label: "어휘", emoji: "🔤" },
  grammar: { label: "문법", emoji: "✏️" },
  reading: { label: "독해", emoji: "📖" },
  listening: { label: "듣기", emoji: "🎧" },
};

// 레벨(1~5)별 친근한 이름/색 (초등 저학년용)
export const LEVEL_META: Record<number, { name: string; emoji: string; color: string }> = {
  1: { name: "씨앗", emoji: "🌱", color: "#9ccc65" },
  2: { name: "새싹", emoji: "🌿", color: "#66bb6a" },
  3: { name: "잎새", emoji: "🍀", color: "#26a69a" },
  4: { name: "꽃", emoji: "🌸", color: "#ec407a" },
  5: { name: "열매", emoji: "🍎", color: "#ef5350" },
};

export function levelLabel(level: number): string {
  const m = LEVEL_META[level];
  return m ? `Lv.${level} ${m.name} ${m.emoji}` : `Lv.${level}`;
}
