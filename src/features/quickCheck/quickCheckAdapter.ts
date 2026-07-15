import { scoreQuickCheckAttempt } from "../../../shared/quickCheckScoring.mjs";
import type {
  QuickCheckAnswerRecord,
  QuickCheckContentRef,
  QuickCheckCorrectAnswer,
  QuickCheckIndexBase,
  QuickCheckLoadResult,
  QuickCheckOption,
  QuickCheckPointState,
  QuickCheckQuestion,
  QuickCheckQuestionKind,
  QuickCheckSourceContract,
  QuickCheckSubmissionResult,
  QuickCheckSubItem
} from "./quickCheckTypes";

type UnknownRecord = Record<string, unknown>;

export function normalizeQuickCheckLoadResponse(value: unknown): QuickCheckLoadResult {
  const payload = recordValue(value);
  const sourceContract = sourceContractValue(payload.sourceContract ?? payload.source_contract);
  const canonicalQuestions = arrayValue(payload.questions)
    .map((question, index) => normalizeCanonicalQuestion(question, index))
    .filter((question): question is QuickCheckQuestion => Boolean(question));

  const rawQuestions = canonicalQuestions.length > 0
    ? []
    : firstArray(payload.quizzes, payload.qlist, payload.qList);
  const fallbackContract = Array.isArray(payload.qlist) ? "unity-new" : Array.isArray(payload.quizzes) ? "metaon3-current" : sourceContract;
  const questions = canonicalQuestions.length > 0
    ? canonicalQuestions
    : rawQuestions.map((question, index) => normalizeRawQuestion(question, index));

  return {
    resultCode: numberValue(payload.resultCode ?? payload.result_code, questions.length > 0 ? 1 : 0),
    resultMessage: stringValue(payload.resultMessage ?? payload.result_message),
    sourceContract: sourceContract === "unknown" ? fallbackContract : sourceContract,
    attemptId: stringValue(payload.attemptId ?? payload.attempt_id),
    questions
  };
}

export function normalizeQuickCheckSubmissionResponse(
  value: unknown,
  questions: QuickCheckQuestion[],
  answers: QuickCheckAnswerRecord
): QuickCheckSubmissionResult {
  const payload = recordValue(value);
  const canonical = recordValue(payload.result);
  const localScore = scoreQuickCheckAttempt(questions, answers);
  const source = Object.keys(canonical).length > 0 ? canonical : payload;
  const rawItems = firstArray(source.items, payload.q_results, payload.qPointlist);
  const items = questions.map((question, index) => {
    const local = localScore.items[index];
    const rawItem = recordValue(
      rawItems.find((item) => numberValue(recordValue(item).qIdx ?? recordValue(item).q_idx) === question.qIdx) ?? rawItems[index]
    );
    const point = numberValue(rawItem.point);
    const correct = booleanValue(rawItem.correct, local?.correct ?? false);
    const rawPointState = stringValue(rawItem.pointState ?? rawItem.point_state);
    const pointState: QuickCheckPointState = rawPointState === "earned-now" || rawPointState === "earned-before" || rawPointState === "none"
      ? rawPointState
      : correct
        ? point > 0
          ? "earned-now"
          : "earned-before"
        : "none";

    return {
      questionId: stringValue(rawItem.questionId ?? rawItem.question_id) || question.id,
      qIdx: question.qIdx,
      correct,
      point,
      pointState,
      ...(rawItem.upstreamCorrect != null || rawItem.upstream_correct != null
        ? { upstreamCorrect: booleanValue(rawItem.upstreamCorrect ?? rawItem.upstream_correct, false) }
        : {})
    };
  });
  const correctCount = numberValue(source.correctCount ?? source.correct_count ?? payload.right_cnt, localScore.correctCount);
  const newPoints = numberValue(source.newPoints ?? source.new_points ?? payload.new_point_cnt);
  const currentPoints = numberValue(source.currentPoints ?? source.current_points ?? payload.spoint ?? payload.userPoint);

  return {
    resultCode: numberValue(payload.resultCode ?? payload.result_code, 1),
    resultMessage: stringValue(payload.resultMessage ?? payload.result_message),
    total: numberValue(source.total, questions.length),
    correctCount,
    newPoints,
    currentPoints,
    existingPoints: numberValue(source.existingPoints ?? source.existing_points, Math.max(0, currentPoints - newPoints)),
    lessonPoints: numberValue(source.lessonPoints ?? source.lesson_points ?? payload.lpoint ?? payload.userLPoint),
    level: numberValue(source.level ?? payload.llevel),
    gradedBy: stringValue(source.gradedBy ?? source.graded_by) === "bff-final-rule" ? "bff-final-rule" : "client-fallback",
    duplicate: booleanValue(source.duplicate ?? payload.duplicate, false),
    items
  };
}

export function normalizeRawQuestion(value: unknown, index: number): QuickCheckQuestion {
  const raw = recordValue(value);
  const qIdx = numberValue(raw.qIdx ?? raw.q_idx ?? raw.qc_idx, index + 1);
  const quizCode = numberValue(raw.quizCode ?? raw.quiz_code ?? raw.qcode, 100);
  const unityType = unityTypeValue(raw.unityType ?? raw.unity_type, quizCode);
  const qjson = parseJsonObject(raw.qjson ?? raw.qJson ?? raw.JsonData);
  const sourceIndexBase: QuickCheckIndexBase = unityType >= 9 ? 0 : 1;
  const common = {
    id: stringValue(raw.id) || `qc:${qIdx}`,
    qIdx,
    sequence: numberValue(raw.sequence ?? raw.qnum, index + 1),
    quizCode,
    unityType,
    sourceIndexBase,
    indexBase: 0 as const,
    question: cleanUnityText(raw.question),
    questionKo: cleanUnityText(raw.questionKo ?? raw.question_ko),
    questionSoundUrl: stringValue(raw.questionSoundUrl ?? raw.question_snd ?? raw.questionsnd),
    exampleText: cleanUnityText(raw.exampleText ?? raw.exam_text ?? raw.extext),
    exampleImageUrl: stringValue(raw.exampleImageUrl ?? raw.exam_img ?? raw.eximg),
    exampleSoundUrl: stringValue(raw.exampleSoundUrl ?? raw.exam_snd ?? raw.exsnd),
    attributeName: stringValue(raw.attributeName ?? raw.att_info ?? raw.attName),
    options: normalizeFlatOptions(raw),
    subItems: [] as QuickCheckSubItem[],
    tokens: [] as string[],
    blankPositions: [] as number[],
    contentRefs: normalizeContentRefs(raw, qjson)
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
    const subItems = quizItems.map((item, itemIndex) => {
      const itemRecord = recordValue(item);
      return {
        id: `qc:${qIdx}:multi:${itemIndex}`,
        prompt: cleanUnityText(itemRecord.text ?? itemRecord.question),
        imageUrl: stringValue(itemRecord.img ?? itemRecord.image),
        audioUrl: stringValue(itemRecord.snd ?? itemRecord.audio),
        options: arrayValue(itemRecord.answers).map((option, optionIndex) => normalizeOption(option, optionIndex, 1))
      };
    });
    return {
      ...common,
      kind: "multi-select",
      subItems,
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
    const blankPositions = arrayValue(qjson.blank_index ?? qjson.blankIndex).map((position) => numberValue(position, -1)).filter((position) => position >= 0);
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
    const answerOption = normalizeOption(qjson.answer, 0, 0);
    return {
      ...common,
      kind: "drag-image",
      options: [answerOption],
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
        // Unity indexed right_answer by token index here. Blank order is the actual contract.
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

function normalizeCanonicalQuestion(value: unknown, index: number): QuickCheckQuestion | null {
  const raw = recordValue(value);
  if (!raw.correctAnswer || !raw.kind) return null;

  const correctAnswer = normalizeCanonicalCorrectAnswer(raw.correctAnswer);
  if (!correctAnswer) return null;

  return {
    id: stringValue(raw.id) || `qc:${numberValue(raw.qIdx ?? raw.q_idx, index + 1)}`,
    qIdx: numberValue(raw.qIdx ?? raw.q_idx, index + 1),
    sequence: numberValue(raw.sequence, index + 1),
    quizCode: numberValue(raw.quizCode ?? raw.quiz_code, 100),
    unityType: numberValue(raw.unityType ?? raw.unity_type, 1),
    kind: questionKindValue(raw.kind),
    sourceIndexBase: numberValue(raw.sourceIndexBase ?? raw.source_index_base) === 0 ? 0 : 1,
    indexBase: 0,
    question: cleanUnityText(raw.question),
    questionKo: cleanUnityText(raw.questionKo ?? raw.question_ko),
    questionSoundUrl: stringValue(raw.questionSoundUrl ?? raw.question_sound_url),
    exampleText: cleanUnityText(raw.exampleText ?? raw.example_text),
    exampleImageUrl: stringValue(raw.exampleImageUrl ?? raw.example_image_url),
    exampleSoundUrl: stringValue(raw.exampleSoundUrl ?? raw.example_sound_url),
    attributeName: stringValue(raw.attributeName ?? raw.attribute_name),
    options: arrayValue(raw.options).map((option, optionIndex) => normalizeCanonicalOption(option, optionIndex)),
    subItems: arrayValue(raw.subItems ?? raw.sub_items).map((item, itemIndex) => normalizeCanonicalSubItem(item, itemIndex)),
    tokens: arrayValue(raw.tokens).map(stringValue),
    blankPositions: arrayValue(raw.blankPositions ?? raw.blank_positions).map((position) => numberValue(position)).filter(Number.isInteger),
    contentRefs: normalizeCanonicalContentRefs(raw.contentRefs ?? raw.content_refs),
    correctAnswer
  };
}

function normalizeCanonicalContentRefs(value: unknown): QuickCheckContentRef[] {
  return arrayValue(value).flatMap((item) => {
    const raw = recordValue(item);
    const itemType = stringValue(raw.itemType ?? raw.item_type);
    const itemIdx = numberValue(raw.itemIdx ?? raw.item_idx);
    if ((itemType !== "word" && itemType !== "sentence") || itemIdx <= 0) return [];
    const subItemIndex = numberValue(raw.subItemIndex ?? raw.sub_item_index, -1);
    return [{
      itemType,
      itemIdx,
      ...(subItemIndex >= 0 ? { subItemIndex } : {})
    }];
  });
}

function normalizeContentRefs(raw: UnknownRecord, qjson: UnknownRecord): QuickCheckContentRef[] {
  const refs: QuickCheckContentRef[] = [];
  const seen = new Set<string>();

  function add(itemType: QuickCheckContentRef["itemType"], value: unknown, subItemIndex?: number) {
    const values = Array.isArray(value) ? value : [value];
    values.forEach((candidate) => {
      const itemIdx = numberValue(candidate);
      if (itemIdx <= 0) return;
      const key = `${itemType}:${itemIdx}:${subItemIndex ?? ""}`;
      if (seen.has(key)) return;
      seen.add(key);
      refs.push({ itemType, itemIdx, ...(subItemIndex == null ? {} : { subItemIndex }) });
    });
  }

  [raw, qjson].forEach((source) => {
    add("word", source.word_idx ?? source.wordIdx ?? source.content_word_idx);
    add("sentence", source.sentence_idx ?? source.sentenceIdx ?? source.content_sentence_idx);
    const itemType = stringValue(source.item_type ?? source.itemType);
    if (itemType === "word" || itemType === "sentence") add(itemType, source.item_idx ?? source.itemIdx);
  });

  arrayValue(qjson.quiz).forEach((item, subItemIndex) => {
    const source = recordValue(item);
    add("word", source.word_idx ?? source.wordIdx ?? source.content_word_idx, subItemIndex);
    add("sentence", source.sentence_idx ?? source.sentenceIdx ?? source.content_sentence_idx, subItemIndex);
  });

  return refs;
}

function normalizeCanonicalCorrectAnswer(value: unknown): QuickCheckCorrectAnswer | null {
  const raw = recordValue(value);
  if (raw.mode === "text") return { mode: "text", value: stringValue(raw.value) };
  if (raw.mode === "composite") {
    return { mode: "composite", selectedIndexes: arrayValue(raw.selectedIndexes ?? raw.selected_indexes).map((item) => numberValue(item, -1)) };
  }
  if (raw.mode === "single") return { mode: "single", selectedIndex: numberValue(raw.selectedIndex ?? raw.selected_index, -1) };
  return null;
}

function normalizeCanonicalOption(value: unknown, index: number): QuickCheckOption {
  const raw = recordValue(value);
  return {
    index: numberValue(raw.index, index),
    sourceIndex: numberValue(raw.sourceIndex ?? raw.source_index, index),
    label: cleanUnityText(raw.label ?? raw.text),
    imageUrl: stringValue(raw.imageUrl ?? raw.image_url ?? raw.img),
    audioUrl: stringValue(raw.audioUrl ?? raw.audio_url ?? raw.snd)
  };
}

function normalizeCanonicalSubItem(value: unknown, index: number): QuickCheckSubItem {
  const raw = recordValue(value);
  return {
    id: stringValue(raw.id) || `sub:${index}`,
    prompt: cleanUnityText(raw.prompt ?? raw.text),
    imageUrl: stringValue(raw.imageUrl ?? raw.image_url ?? raw.img),
    audioUrl: stringValue(raw.audioUrl ?? raw.audio_url ?? raw.snd),
    options: arrayValue(raw.options).map((option, optionIndex) => normalizeCanonicalOption(option, optionIndex))
  };
}

function normalizeFlatOptions(raw: UnknownRecord): QuickCheckOption[] {
  const configuredCount = numberValue(raw.answerCount ?? raw.answer_cnt ?? raw.answercnt);
  const count = configuredCount > 0 ? configuredCount : 8;
  const options: QuickCheckOption[] = [];
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

function normalizeOption(value: unknown, index: number, sourceBase: QuickCheckIndexBase): QuickCheckOption {
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

function indexedAnswer(value: unknown, tokenIndex: number, blankIndex: number): unknown {
  if (Array.isArray(value)) {
    if (tokenIndex < value.length && value[tokenIndex] != null) return value[tokenIndex];
    return value[blankIndex];
  }
  const raw = recordValue(value);
  return raw[String(tokenIndex)] ?? raw[String(blankIndex)];
}

function normalizeIndex(value: unknown, sourceBase: QuickCheckIndexBase): number {
  const parsed = numberValue(value, -1);
  return Number.isInteger(parsed) ? parsed - sourceBase : -1;
}

function unityTypeValue(explicitValue: unknown, quizCode: number): number {
  const explicit = numberValue(explicitValue);
  if (explicit >= 1 && explicit <= 11) return explicit;
  const fromCode = quizCode >= 100 ? Math.trunc(quizCode / 100) : quizCode;
  return fromCode >= 1 && fromCode <= 11 ? fromCode : 1;
}

function sourceContractValue(value: unknown): QuickCheckSourceContract {
  return value === "metaon3-current" || value === "unity-new" ? value : "unknown";
}

function questionKindValue(value: unknown): QuickCheckQuestionKind {
  const kind = stringValue(value);
  if (
    kind === "single-select" ||
    kind === "sentence-input" ||
    kind === "multi-select" ||
    kind === "connect-line" ||
    kind === "drag-alphabet" ||
    kind === "drag-image" ||
    kind === "drag-sentence"
  ) return kind;
  return "single-select";
}

function cleanUnityText(value: unknown): string {
  return stringValue(value)
    .replace(/\\n/g, "\n")
    .replace(/\[(?:\/?(?:b|i|u|s)|color(?:=[^\]]+)?|\/color)\]/gi, "")
    .trim();
}

function parseJsonObject(value: unknown): UnknownRecord {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as UnknownRecord;
  if (typeof value !== "string" || !value.trim()) return {};
  try {
    return recordValue(JSON.parse(value));
  } catch {
    return {};
  }
}

function firstArray(...values: unknown[]): unknown[] {
  return arrayValue(values.find((value) => Array.isArray(value) && value.length > 0) ?? values.find(Array.isArray));
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function recordValue(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : {};
}

function stringValue(value: unknown): string {
  return value == null ? "" : String(value);
}

function numberValue(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1" || value === "true" || value === "O") return true;
  if (value === 0 || value === "0" || value === "false" || value === "X") return false;
  return fallback;
}
