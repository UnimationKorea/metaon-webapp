import { useEffect } from "react";
import { isSpeechSupported, speak } from "../speech";
import type { Question } from "../types";

interface Props {
  question: Question;
  picked: number | undefined;
  onChoose: (idx: number) => void;
}

// 보기가 이모지(그림)인지 판별 → 그리드 크게 표시
function looksLikeEmoji(choices: string[]): boolean {
  return choices.every((c) => c.length <= 3 && !/[a-zA-Z0-9]/.test(c));
}

function normalizePassageText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export default function QuestionView({ question, picked, onChoose }: Props) {
  const isListening = question.type.startsWith("audio");

  // 듣기 문항은 화면에 나타날 때 자동으로 한 번 읽어준다
  useEffect(() => {
    if (isListening && question.speak) speak(question.speak);
  }, [question.id]);

  const emojiChoices = looksLikeEmoji(question.choices);

  return (
    <div className="question">
      <p className="prompt">{question.prompt}</p>

      {question.emoji && <div className="big-emoji">{question.emoji}</div>}

      {question.passage && <div className="passage">{normalizePassageText(question.passage)}</div>}

      {question.sentence && <div className="sentence">{normalizePassageText(question.sentence)}</div>}

      {isListening && (
        <button
          className="speak-btn"
          onClick={() => question.speak && speak(question.speak)}
          disabled={!isSpeechSupported()}
        >
          🔊 다시 듣기
        </button>
      )}

      <div className={emojiChoices ? "choices grid" : "choices list"}>
        {question.choices.map((choice, idx) => (
          <button
            key={idx}
            className={`choice ${picked === idx ? "selected" : ""} ${
              emojiChoices ? "emoji" : ""
            }`}
            onClick={() => onChoose(idx)}
          >
            {choice}
          </button>
        ))}
      </div>
    </div>
  );
}
