function isIntegerIndex(value) {
  return Number.isInteger(value) && value >= 0;
}

export function createEmptyQuickCheckAnswer(question) {
  if (question?.correctAnswer?.mode === "text") {
    return { mode: "text", value: "" };
  }

  if (question?.correctAnswer?.mode === "composite") {
    return {
      mode: "composite",
      selectedIndexes: Array.from(
        { length: question.correctAnswer.selectedIndexes.length },
        () => null
      )
    };
  }

  return { mode: "single", selectedIndex: null };
}

export function isQuickCheckAnswerComplete(question, answer) {
  if (!question || !answer) return false;

  if (question.correctAnswer?.mode === "text") {
    return answer.mode === "text" && typeof answer.value === "string" && answer.value.trim().length > 0;
  }

  if (question.correctAnswer?.mode === "composite") {
    const expectedCount = question.correctAnswer.selectedIndexes.length;
    return (
      answer.mode === "composite" &&
      Array.isArray(answer.selectedIndexes) &&
      answer.selectedIndexes.length === expectedCount &&
      answer.selectedIndexes.every(isIntegerIndex)
    );
  }

  return answer.mode === "single" && isIntegerIndex(answer.selectedIndex);
}

export function scoreQuickCheckAnswer(question, answer) {
  if (!question || !answer) return false;

  const correctAnswer = question.correctAnswer;
  if (correctAnswer?.mode === "text") {
    return answer.mode === "text" && answer.value === correctAnswer.value;
  }

  if (correctAnswer?.mode === "composite") {
    if (answer.mode !== "composite" || !Array.isArray(answer.selectedIndexes)) return false;

    const total = correctAnswer.selectedIndexes.length;
    if (total === 0) return false;

    let correctCount = 0;
    for (let index = 0; index < total; index += 1) {
      if (answer.selectedIndexes[index] === correctAnswer.selectedIndexes[index]) {
        correctCount += 1;
      }
    }

    return correctCount > total / 2;
  }

  return answer.mode === "single" && answer.selectedIndex === correctAnswer?.selectedIndex;
}

export function scoreQuickCheckAttempt(questions, answersByQuestionId) {
  const items = questions.map((question) => {
    const answer = answersByQuestionId?.[question.id];
    return {
      questionId: question.id,
      qIdx: question.qIdx,
      complete: isQuickCheckAnswerComplete(question, answer),
      correct: scoreQuickCheckAnswer(question, answer)
    };
  });

  return {
    total: items.length,
    correctCount: items.filter((item) => item.correct).length,
    complete: items.length > 0 && items.every((item) => item.complete),
    items
  };
}
