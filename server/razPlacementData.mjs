import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DATA_DIR = path.join(__dirname, "data", "raz-placement");

const FORM_DEFINITIONS = [
  { id: "raz-form-1", fileName: "raz_items.json" },
  { id: "raz-form-2", fileName: "raz_items_2.json" },
  { id: "raz-form-3", fileName: "raz_items_3.json" }
];

export const RAZ_START_LEVEL_BY_GRADE = {
  kinder: "aa",
  e1: "A",
  e2: "C",
  e3: "F",
  e4: "J",
  e5: "M",
  e6: "P",
  m1: "S"
};

export function loadRazPlacementSets(dataDir = DEFAULT_DATA_DIR) {
  const sets = FORM_DEFINITIONS.map(({ id, fileName }) => {
    const filePath = path.join(dataDir, fileName);
    const source = JSON.parse(readFileSync(filePath, "utf8"));
    return {
      id,
      fileName,
      units: normalizeRazPlacementUnits(source, id)
    };
  });

  validateMatchingLevelOrder(sets);
  return sets;
}

export function normalizeRazPlacementUnits(source, formId) {
  if (!Array.isArray(source) || source.length === 0) {
    throw new Error(`${formId} must contain a non-empty placement unit array.`);
  }

  return source.map((rawUnit, unitIndex) => {
    const grade = requiredString(rawUnit?.grade, `${formId}[${unitIndex}].grade`);
    const level = requiredString(rawUnit?.level, `${formId}[${unitIndex}].level`);
    const passage = requiredString(rawUnit?.passage, `${formId}[${unitIndex}].passage`);
    const sourceItems = rawUnit?.items;

    if (!Array.isArray(sourceItems) || sourceItems.length === 0) {
      throw new Error(`${formId} Level ${level} must contain at least one item.`);
    }

    const items = sourceItems.map((rawItem, itemIndex) => {
      const itemId = requiredString(rawItem?.id, `${formId} Level ${level} item ${itemIndex}.id`);
      const skill = requiredString(rawItem?.skill, `${formId} Level ${level} item ${itemIndex}.skill`);
      const question = requiredString(rawItem?.q, `${formId} Level ${level} item ${itemIndex}.q`);
      const choices = Array.isArray(rawItem?.choices) ? rawItem.choices.map(String) : [];
      const answerIndex = Number(rawItem?.answer);

      if (skill !== "reading" && skill !== "vocab") {
        throw new Error(`${formId} Level ${level} item ${itemId} has an unsupported skill.`);
      }
      if (choices.length < 2) {
        throw new Error(`${formId} Level ${level} item ${itemId} must contain at least two choices.`);
      }
      if (!Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex >= choices.length) {
        throw new Error(`${formId} Level ${level} item ${itemId} has an invalid answer index.`);
      }

      return {
        id: `raz:${grade}:${level}:${itemId}`,
        sourceId: itemId,
        skill,
        q: question,
        choices,
        answerIndex
      };
    });

    if (new Set(items.map((item) => item.id)).size !== items.length) {
      throw new Error(`${formId} Level ${level} contains duplicate item IDs.`);
    }

    const targetLexile = Number(rawUnit?.targetLexile);
    return {
      id: `${formId}:${grade}:${level}`,
      formId,
      grade,
      level,
      seriesId: Number(rawUnit?.seriesId) || 0,
      targetLexile: Number.isFinite(targetLexile) ? targetLexile : 0,
      lexile: Number.isFinite(targetLexile) ? targetLexile : 0,
      passage,
      globalAccuracy: null,
      globalAvgMs: null,
      globalN: 0,
      items
    };
  });
}

export function startRazIndexForGrade(units, requestedGrade) {
  const targetLevel = RAZ_START_LEVEL_BY_GRADE[requestedGrade] || RAZ_START_LEVEL_BY_GRADE.e2;
  const index = units.findIndex((unit) => unit.level === targetLevel);
  return index >= 0 ? index : 0;
}

function validateMatchingLevelOrder(sets) {
  const expected = sets[0]?.units.map((unit) => `${unit.grade}:${unit.level}`) || [];
  for (const set of sets.slice(1)) {
    const actual = set.units.map((unit) => `${unit.grade}:${unit.level}`);
    if (actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) {
      throw new Error(`${set.id} does not match the level order of ${sets[0].id}.`);
    }
  }
}

function requiredString(value, fieldName) {
  const normalized = String(value ?? "").trim();
  if (!normalized) throw new Error(`${fieldName} is required.`);
  return normalized;
}

export const RAZ_PLACEMENT_SETS = loadRazPlacementSets();
