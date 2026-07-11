import {
  isQuickCheckAnswerComplete,
  scoreQuickCheckAttempt
} from "../shared/quickCheckScoring.mjs";

export const QUICK_CHECK_CURRENT_CONTRACT = "metaon3-current";
export const QUICK_CHECK_UNITY_CONTRACT = "unity-new";

export function isSuccessfulQuickCheckResponse(upstream, listKey) {
  return (
    upstream?.status >= 200 &&
    upstream?.status < 300 &&
    numberValue(upstream?.data?.resultCode) === 1 &&
    Array.isArray(upstream?.data?.[listKey])
  );
}

export function normalizeQuickCheckPayload(data, sourceContract) {
  const payload = recordValue(data);
  const rawQuestions = sourceContract === QUICK_CHECK_UNITY_CONTRACT
    ? arrayValue(payload.qlist)
    : arrayValue(payload.quizzes);

  return {
    ...payload,
    sourceContract,
    questions: rawQuestions.map((question, index) => normalizeRawQuestion(question, index))
  };
}

export function buildCurrentQuickCheckRequest(body) {
  const source = recordValue(body);
  return {
    day_idx: numberValue(source.day_idx ?? source.dayIdx)
  };
}

export function buildLegacyQuickCheckRequest(body, userIdx) {
  const source = recordValue(body);
  return {
    userIdx: numberValue(userIdx ?? source.user_idx ?? source.userIdx),
    bookIdx: numberValue(source.book_idx ?? source.bookIdx),
    lessonNum: numberValue(source.lesson_num ?? source.lessonNum),
    dayNum: numberValue(source.day_num ?? source.dayNum)
  };
}

export function normalizeSubmittedQuickCheckAnswers(questions, submittedEntries) {
  const entries = arrayValue(submittedEntries).map(recordValue);
  const answersByQuestionId = {};
  const metadataByQuestionId = {};

  for (const question of questions) {
    const entry = entries.find((candidate) => numberValue(candidate.q_idx ?? candidate.qIdx) === question.qIdx);
    const answer = normalizeAnswerForQuestion(question, entry?.answer);
    answersByQuestionId[question.id] = answer;
    metadataByQuestionId[question.id] = {
      timeMs: Math.max(0, numberValue(entry?.time_ms ?? entry?.timeMs)),
      answeredAt: stringValue(entry?.answered_at ?? entry?.answeredAt) || new Date().toISOString()
    };
  }

  return { answersByQuestionId, metadataByQuestionId };
}

export function validateQuickCheckSubmission(questions, answersByQuestionId) {
  const incompleteQuestionIds = questions
    .filter((question) => !isQuickCheckAnswerComplete(question, answersByQuestionId[question.id]))
    .map((question) => question.id);
  return {
    complete: questions.length > 0 && incompleteQuestionIds.length === 0,
    incompleteQuestionIds
  };
}

export function buildCurrentQuickCheckSubmission(logIdx, questions, answersByQuestionId, metadataByQuestionId) {
  const score = scoreQuickCheckAttempt(questions, answersByQuestionId);
  return {
    payload: {
      log_idx: numberValue(logIdx),
      results: questions.map((question, index) => ({
        qc_idx: question.qIdx,
        u_answer: serializeCurrentAnswer(question, answersByQuestionId[question.id]),
        correct: score.items[index]?.correct ? 1 : 0,
        sec: Math.max(0, Math.round(numberValue(metadataByQuestionId[question.id]?.timeMs) / 1000))
      }))
    },
    score
  };
}

export function buildLegacyQuickCheckSubmission({
  userIdx,
  context,
  questions,
  answersByQuestionId,
  metadataByQuestionId
}) {
  const score = scoreQuickCheckAttempt(questions, answersByQuestionId);
  const source = recordValue(context);
  return {
    payload: {
      userIdx: numberValue(userIdx),
      bookIdx: numberValue(source.book_idx ?? source.bookIdx),
      bookDataVer: stringValue(source.book_data_ver ?? source.bookDataVer),
      lessonNum: numberValue(source.lesson_num ?? source.lessonNum),
      dayNum: numberValue(source.day_num ?? source.dayNum),
      actCode: numberValue(source.act_code ?? source.actCode, 65),
      actNum: numberValue(source.act_num ?? source.actNum),
      qidxlog: questions.map((question) => question.qIdx).join("/"),
      quizlog: score.items.map((item) => item.correct ? "O" : "X").join("/"),
      // Free text and composite values are encoded as a single delimiter-safe token.
      useranswer: questions.map((question) => serializeLegacyAnswer(question, answersByQuestionId[question.id])).join("/"),
      timelog: questions.map((question) => metadataByQuestionId[question.id]?.answeredAt || "").join("/")
    },
    score
  };
}

export function normalizeQuickCheckSubmission(data, questions, score, duplicate = false) {
  const payload = recordValue(data);
  const modernItems = arrayValue(payload.q_results);
  const unityPoints = arrayValue(payload.qPointlist);
  const historicalLog = stringValue(payload.resultQuizlog).split("/");
  const newPoints = payload.new_point_cnt != null
    ? numberValue(payload.new_point_cnt)
    : unityPoints.reduce((sum, item) => sum + numberValue(recordValue(item).point), 0);
  const currentPoints = numberValue(payload.spoint ?? payload.userPoint);

  const items = questions.map((question, index) => {
    const localCorrect = Boolean(score.items[index]?.correct);
    const modern = recordValue(
      modernItems.find((item) => numberValue(recordValue(item).qc_idx) === question.qIdx) ?? modernItems[index]
    );
    const unity = recordValue(
      unityPoints.find((item) => numberValue(recordValue(item).num) === index + 1) ?? unityPoints[index]
    );
    const point = numberValue(modern.point ?? unity.point);
    const previouslyCorrect = historicalLog[index] === "O";
    return {
      questionId: question.id,
      qIdx: question.qIdx,
      correct: localCorrect,
      point,
      pointState: localCorrect ? point > 0 ? "earned-now" : "earned-before" : "none",
      ...(modern.correct != null ? { upstreamCorrect: booleanValue(modern.correct, false) } : {}),
      previouslyCorrect
    };
  });

  return {
    ...payload,
    duplicate,
    result: {
      total: questions.length,
      correctCount: score.correctCount,
      newPoints,
      currentPoints,
      existingPoints: Math.max(0, currentPoints - newPoints),
      lessonPoints: numberValue(payload.lpoint ?? payload.userLPoint),
      level: numberValue(payload.llevel),
      gradedBy: "bff-final-rule",
      duplicate,
      items
    }
  };
}

export function normalizeRawQuestion(value, index) {
  const raw = recordValue(value);
  const qIdx = numberValue(raw.qIdx ?? raw.q_idx ?? raw.qc_idx, index + 1);
  const quizCode = numberValue(raw.quizCode ?? raw.quiz_code ?? raw.qcode, 100);
  const unityType = unityTypeValue(raw.unityType ?? raw.unity_type, quizCode);
  const qjson = parseJsonObject(raw.qjson ?? raw.qJson ?? raw.JsonData);
  const sourceIndexBase = unityType >= 9 ? 0 : 1;
  const common = {
    id: stringValue(raw.id) || `qc:${qIdx}`,
    qIdx,
    sequence: numberValue(raw.sequence ?? raw.qnum, index + 1),
    quizCode,
    unityType,
    sourceIndexBase,
    indexBase: 0,
    question: cleanUnityText(raw.question),
    questionKo: cleanUnityText(raw.questionKo ?? raw.question_ko),
    questionSoundUrl: stringValue(raw.questionSoundUrl ?? raw.question_snd ?? raw.questionsnd),
    exampleText: cleanUnityText(raw.exampleText ?? raw.exam_text ?? raw.extext),
    exampleImageUrl: stringValue(raw.exampleImageUrl ?? raw.exam_img ?? raw.eximg),
    exampleSoundUrl: stringValue(raw.exampleSoundUrl ?? raw.exam_snd ?? raw.exsnd),
    attributeName: stringValue(raw.attributeName ?? raw.att_info ?? raw.attName),
    options: normalizeFlatOptions(raw),
    subItems: [],
    tokens: [],
    blankPositions: []
  };

  if (unityType === 5) {
    return {
      ...common,
      kind: "sentence-input",
      correctAnswer: { mode: "text", value: stringValue(raw.correctAnswerValue ?? raw.sub_answer ?? raw.subAnswer) }
    };
  }

  if (unityType === 6) {
    const quizItems = arrayValue(qjson.quiz);
    return {
      ...common,
      kind: "multi-select",
      subItems: quizItems.map((item, itemIndex) => {
        const itemRecord = recordValue(item);
        return {
          id: `qc:${qIdx}:multi:${itemIndex}`,
          prompt: cleanUnityText(itemRecord.text ?? itemRecord.question),
          imageUrl: stringValue(itemRecord.img ?? itemRecord.image),
          audioUrl: stringValue(itemRecord.snd ?? itemRecord.audio),
          options: arrayValue(itemRecord.answers).map((option, optionIndex) => normalizeOption(option, optionIndex, 1))
        };
      }),
      correctAnswer: {
        mode: "composite",
        selectedIndexes: quizItems.map((item) => normalizeIndex(recordValue(item).rightAnswer ?? recordValue(item).right_answer, 1))
      }
    };
  }

  if (unityType === 7) {
    const quiz = recordValue(qjson.quiz);
    const rightOptions = arrayValue(quiz.right).map((item, optionIndex) => normalizeOption(item, optionIndex, 1));
    const leftItems = arrayValue(quiz.left);
    return {
      ...common,
      kind: "connect-line",
      options: rightOptions,
      subItems: leftItems.map((item, itemIndex) => {
        const itemRecord = recordValue(item);
        return {
          id: `qc:${qIdx}:line:${itemIndex}`,
          prompt: cleanUnityText(itemRecord.text ?? itemRecord.label),
          imageUrl: stringValue(itemRecord.img ?? itemRecord.image),
          audioUrl: stringValue(itemRecord.snd ?? itemRecord.audio)
        };
      }),
      correctAnswer: {
        mode: "composite",
        selectedIndexes: leftItems.map((item) => normalizeIndex(recordValue(item).linkNum ?? recordValue(item).link_num, 1))
      }
    };
  }

  if (unityType === 9) {
    const prompt = stringValue(qjson.question);
    const blankPositions = arrayValue(qjson.blank_index ?? qjson.blankIndex)
      .map((position) => numberValue(position, -1))
      .filter((position) => position >= 0);
    const rightAnswers = qjson.right_answer ?? qjson.rightAnswer;
    return {
      ...common,
      kind: "drag-alphabet",
      question: common.question || prompt,
      options: arrayValue(qjson.answers).map((option, optionIndex) => normalizeOption(option, optionIndex, 0)),
      tokens: Array.from(prompt),
      blankPositions,
      correctAnswer: {
        mode: "composite",
        selectedIndexes: blankPositions.map((tokenIndex, blankIndex) => normalizeIndex(indexedAnswer(rightAnswers, tokenIndex, blankIndex), 0))
      }
    };
  }

  if (unityType === 10) {
    const slots = arrayValue(qjson.question);
    return {
      ...common,
      kind: "drag-image",
      options: [normalizeOption(qjson.answer, 0, 0)],
      subItems: slots.map((slot, slotIndex) => {
        const slotRecord = recordValue(slot);
        return {
          id: `qc:${qIdx}:slot:${slotIndex}`,
          prompt: cleanUnityText(slotRecord.text),
          imageUrl: stringValue(slotRecord.img ?? slotRecord.image)
        };
      }),
      correctAnswer: {
        mode: "single",
        selectedIndex: normalizeIndex(qjson.right_answer ?? qjson.rightAnswer ?? raw.right_answer ?? raw.rightAns, 0)
      }
    };
  }

  if (unityType === 11) {
    const tokens = arrayValue(qjson.question).map(stringValue);
    const blankPositions = tokens.flatMap((token, tokenIndex) => token === "_" ? [tokenIndex] : []);
    const rightAnswers = arrayValue(qjson.right_answer ?? qjson.rightAnswer);
    return {
      ...common,
      kind: "drag-sentence",
      options: arrayValue(qjson.answers).map((option, optionIndex) => normalizeOption(option, optionIndex, 0)),
      tokens,
      blankPositions,
      correctAnswer: {
        mode: "composite",
        // Map by blank order. The Unity Type 11 implementation incorrectly used token index here.
        selectedIndexes: blankPositions.map((_tokenIndex, blankIndex) => normalizeIndex(rightAnswers[blankIndex], 0))
      }
    };
  }

  return {
    ...common,
    kind: "single-select",
    correctAnswer: {
      mode: "single",
      selectedIndex: normalizeIndex(raw.correctSelectedIndex ?? raw.right_answer ?? raw.rightAns, sourceIndexBase)
    }
  };
}

function normalizeAnswerForQuestion(question, value) {
  const raw = recordValue(value);
  if (question.correctAnswer.mode === "text") {
    return { mode: "text", value: stringValue(raw.value) };
  }
  if (question.correctAnswer.mode === "composite") {
    const selections = arrayValue(raw.selectedIndexes ?? raw.selected_indexes);
    return {
      mode: "composite",
      selectedIndexes: question.correctAnswer.selectedIndexes.map((_answer, index) => {
        const selected = Number(selections[index]);
        return Number.isInteger(selected) && selected >= 0 ? selected : null;
      })
    };
  }
  const selected = Number(raw.selectedIndex ?? raw.selected_index);
  return { mode: "single", selectedIndex: Number.isInteger(selected) && selected >= 0 ? selected : null };
}

function serializeCurrentAnswer(question, answer) {
  if (answer?.mode === "text") return answer.value;
  if (answer?.mode === "composite") {
    return JSON.stringify(answer.selectedIndexes.map((index) => index == null ? null : index + question.sourceIndexBase));
  }
  if (answer?.mode === "single" && answer.selectedIndex != null) {
    return String(answer.selectedIndex + question.sourceIndexBase);
  }
  return "";
}

function serializeLegacyAnswer(question, answer) {
  if (answer?.mode === "single" && answer.selectedIndex != null) {
    return String(answer.selectedIndex + question.sourceIndexBase);
  }
  const json = JSON.stringify({ version: 1, answer });
  return `json:${Buffer.from(json, "utf8").toString("base64url")}`;
}

function normalizeFlatOptions(raw) {
  const configuredCount = numberValue(raw.answerCount ?? raw.answer_cnt ?? raw.answercnt);
  const count = configuredCount > 0 ? configuredCount : 8;
  const options = [];
  for (let offset = 0; offset < count; offset += 1) {
    const sourceIndex = offset + 1;
    const label = cleanUnityText(raw[`answer_${sourceIndex}`] ?? raw[`ans_${sourceIndex}`]);
    const imageUrl = stringValue(raw[`a${sourceIndex}_img`]);
    const audioUrl = stringValue(raw[`a${sourceIndex}_snd`]);
    if (!label && !imageUrl && !audioUrl) continue;
    options.push({ index: options.length, sourceIndex, label, imageUrl, audioUrl });
  }
  return options;
}

function normalizeOption(value, index, sourceBase) {
  if (typeof value === "string" || typeof value === "number") {
    return { index, sourceIndex: index + sourceBase, label: cleanUnityText(value) };
  }
  const raw = recordValue(value);
  return {
    index,
    sourceIndex: index + sourceBase,
    label: cleanUnityText(raw.text ?? raw.label ?? raw.answer),
    imageUrl: stringValue(raw.img ?? raw.image ?? raw.imageUrl),
    audioUrl: stringValue(raw.snd ?? raw.audio ?? raw.audioUrl)
  };
}

function indexedAnswer(value, tokenIndex, blankIndex) {
  if (Array.isArray(value)) {
    if (tokenIndex < value.length && value[tokenIndex] != null) return value[tokenIndex];
    return value[blankIndex];
  }
  const raw = recordValue(value);
  return raw[String(tokenIndex)] ?? raw[String(blankIndex)];
}

function normalizeIndex(value, sourceBase) {
  const parsed = numberValue(value, -1);
  return Number.isInteger(parsed) ? parsed - sourceBase : -1;
}

function unityTypeValue(explicitValue, quizCode) {
  const explicit = numberValue(explicitValue);
  if (explicit >= 1 && explicit <= 11) return explicit;
  const fromCode = quizCode >= 100 ? Math.trunc(quizCode / 100) : quizCode;
  return fromCode >= 1 && fromCode <= 11 ? fromCode : 1;
}

function cleanUnityText(value) {
  return stringValue(value)
    .replace(/\\n/g, "\n")
    .replace(/\[(?:\/?(?:b|i|u|s)|color(?:=[^\]]+)?|\/color)\]/gi, "")
    .trim();
}

function parseJsonObject(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value !== "string" || !value.trim()) return {};
  try {
    return recordValue(JSON.parse(value));
  } catch {
    return {};
  }
}

function arrayValue(value) {
  return Array.isArray(value) ? value : [];
}

function recordValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function stringValue(value) {
  return value == null ? "" : String(value);
}

function numberValue(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function booleanValue(value, fallback) {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1" || value === "true" || value === "O") return true;
  if (value === 0 || value === "0" || value === "false" || value === "X") return false;
  return fallback;
}
