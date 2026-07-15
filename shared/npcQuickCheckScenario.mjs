const MAX_SCENARIO_NODES = 300;

export class NpcQuickCheckScenarioError extends Error {
  constructor(issues) {
    super(`Invalid NPC Quick Check scenario: ${issues.join("; ")}`);
    this.name = "NpcQuickCheckScenarioError";
    this.issues = issues;
  }
}

export function normalizeNpcQuickCheckScenario(value, options = {}) {
  const raw = unwrapScenario(value);
  if (raw == null) return null;
  if (!isObject(raw)) throw new NpcQuickCheckScenarioError(["scenario must be an object"]);

  const issues = [];
  const scenarioId = requiredText(raw.scenarioId ?? raw.scenario_id, "scenarioId", issues);
  const version = positiveInteger(raw.version ?? raw.scenarioVersion ?? raw.scenario_version, "version", issues);
  const bookIdx = scopedInteger(raw.bookIdx ?? raw.book_idx, options.bookIdx, "bookIdx", issues);
  const dayIdx = scopedInteger(raw.dayIdx ?? raw.day_idx, options.dayIdx, "dayIdx", issues);
  const actIdx = scopedInteger(raw.actIdx ?? raw.act_idx, options.actIdx, "actIdx", issues);
  const startNodeId = requiredText(raw.startNodeId ?? raw.start_node_id, "startNodeId", issues);
  const rawNodes = Array.isArray(raw.nodes) ? raw.nodes : [];
  if (rawNodes.length === 0) issues.push("nodes must contain at least one node");
  if (rawNodes.length > MAX_SCENARIO_NODES) issues.push(`nodes exceeds the ${MAX_SCENARIO_NODES} node limit`);

  const nodes = rawNodes.slice(0, MAX_SCENARIO_NODES).map((node, index) => normalizeNode(node, index, issues));
  const scenario = {
    scenarioId,
    version,
    bookIdx,
    dayIdx,
    actIdx,
    locale: optionalText(raw.locale),
    startNodeId,
    npc: normalizeNpc(raw.npc),
    scene: normalizeScene(raw.scene),
    nodes,
    contentHash: optionalText(raw.contentHash ?? raw.content_hash),
    publishedAt: optionalText(raw.publishedAt ?? raw.published_at)
  };

  validateGraph(scenario, options.questionQIdxs, issues);
  if (issues.length > 0) throw new NpcQuickCheckScenarioError(issues);
  return scenario;
}

function unwrapScenario(value) {
  if (value == null) return null;
  if (!isObject(value)) return value;
  if (Object.hasOwn(value, "scenario")) return value.scenario;
  if (isObject(value.data) && Object.hasOwn(value.data, "scenario")) return value.data.scenario;
  if (Object.hasOwn(value, "data") && value.data == null) return null;
  if (isObject(value.data) && (value.data.scenarioId || value.data.scenario_id)) return value.data;
  return value;
}

function normalizeNode(value, index, issues) {
  const raw = isObject(value) ? value : {};
  const prefix = `nodes[${index}]`;
  if (!isObject(value)) issues.push(`${prefix} must be an object`);
  const id = requiredText(raw.id ?? raw.nodeId ?? raw.node_id, `${prefix}.id`, issues);
  const type = optionalText(raw.type).toLowerCase();

  if (type === "dialogue") {
    const speaker = optionalText(raw.speaker).toLowerCase() || "npc";
    if (speaker !== "npc" && speaker !== "student") issues.push(`${prefix}.speaker must be npc or student`);
    return {
      id,
      type,
      speaker: speaker === "student" ? "student" : "npc",
      text: requiredText(raw.text, `${prefix}.text`, issues),
      audioUrl: safeUrl(raw.audioUrl ?? raw.audio_url, `${prefix}.audioUrl`, issues),
      nextNodeId: requiredText(raw.nextNodeId ?? raw.next_node_id ?? raw.next, `${prefix}.nextNodeId`, issues)
    };
  }

  if (type === "question") {
    return {
      id,
      type,
      qIdx: positiveInteger(raw.qIdx ?? raw.q_idx, `${prefix}.qIdx`, issues),
      text: optionalText(raw.text ?? raw.leadText ?? raw.lead_text),
      audioUrl: safeUrl(raw.audioUrl ?? raw.audio_url, `${prefix}.audioUrl`, issues),
      ttsText: optionalText(raw.ttsText ?? raw.tts_text),
      hintText: optionalText(raw.hintText ?? raw.hint_text),
      hintNodeId: optionalText(raw.hintNodeId ?? raw.hint_node_id),
      correctNextNodeId: requiredText(raw.correctNextNodeId ?? raw.correct_next_node_id, `${prefix}.correctNextNodeId`, issues),
      incorrectNextNodeId: requiredText(raw.incorrectNextNodeId ?? raw.incorrect_next_node_id, `${prefix}.incorrectNextNodeId`, issues)
    };
  }

  if (type === "ending") {
    return {
      id,
      type,
      text: requiredText(raw.text, `${prefix}.text`, issues),
      audioUrl: safeUrl(raw.audioUrl ?? raw.audio_url, `${prefix}.audioUrl`, issues)
    };
  }

  issues.push(`${prefix}.type must be dialogue, question, or ending`);
  return { id, type: "ending", text: "" };
}

function normalizeNpc(value) {
  const raw = isObject(value) ? value : {};
  return {
    id: optionalText(raw.id) || "metaon-tutor",
    name: optionalText(raw.name) || "MetaOn Tutor",
    avatarUrl: safeUrl(raw.avatarUrl ?? raw.avatar_url),
    voiceId: optionalText(raw.voiceId ?? raw.voice_id)
  };
}

function normalizeScene(value) {
  const raw = isObject(value) ? value : {};
  return {
    backgroundUrl: safeUrl(raw.backgroundUrl ?? raw.background_url),
    bgmUrl: safeUrl(raw.bgmUrl ?? raw.bgm_url)
  };
}

function validateGraph(scenario, expectedQuestionQIdxs, issues) {
  const nodesById = new Map();
  for (const node of scenario.nodes) {
    if (!node.id) continue;
    if (nodesById.has(node.id)) issues.push(`duplicate node id: ${node.id}`);
    nodesById.set(node.id, node);
  }
  if (scenario.startNodeId && !nodesById.has(scenario.startNodeId)) {
    issues.push(`startNodeId does not exist: ${scenario.startNodeId}`);
  }

  const outgoing = new Map();
  const questionCounts = new Map();
  const auxiliaryNodeIds = new Set();
  for (const node of scenario.nodes) {
    const targets = nodeTargets(node);
    outgoing.set(node.id, targets);
    const referencedTargets = node.type === "question" && node.hintNodeId
      ? [...targets, node.hintNodeId]
      : targets;
    if (node.type === "question" && node.hintNodeId) auxiliaryNodeIds.add(node.hintNodeId);
    for (const target of referencedTargets) {
      if (!nodesById.has(target)) issues.push(`${node.id} references missing node: ${target}`);
    }
    if (node.type === "question" && node.qIdx > 0) {
      questionCounts.set(node.qIdx, (questionCounts.get(node.qIdx) || 0) + 1);
    }
  }

  for (const [qIdx, count] of questionCounts) {
    if (count > 1) issues.push(`qIdx ${qIdx} is referenced by ${count} question nodes`);
  }

  const expected = Array.isArray(expectedQuestionQIdxs)
    ? new Set(expectedQuestionQIdxs.map(Number).filter((item) => Number.isInteger(item) && item > 0))
    : null;
  if (expected) {
    for (const qIdx of questionCounts.keys()) {
      if (!expected.has(qIdx)) issues.push(`scenario references unknown qIdx ${qIdx}`);
    }
    for (const qIdx of expected) {
      if (!questionCounts.has(qIdx)) issues.push(`scenario does not reference qIdx ${qIdx}`);
    }
  }

  if (!nodesById.has(scenario.startNodeId)) return;
  const reachable = walkForward(scenario.startNodeId, outgoing);
  for (const node of scenario.nodes) {
    if (node.id && !reachable.has(node.id) && !auxiliaryNodeIds.has(node.id)) {
      issues.push(`unreachable node: ${node.id}`);
    }
  }

  if (hasCycle(scenario.startNodeId, outgoing)) {
    issues.push("scenario execution path must not contain a cycle");
  }

  const endingIds = scenario.nodes.filter((node) => node.type === "ending").map((node) => node.id);
  if (endingIds.length === 0) {
    issues.push("scenario must contain at least one ending node");
    return;
  }
  const canReachEnding = walkBackward(endingIds, outgoing);
  for (const nodeId of reachable) {
    if (!canReachEnding.has(nodeId)) issues.push(`node cannot reach an ending: ${nodeId}`);
  }
}

function nodeTargets(node) {
  if (node.type === "dialogue") return [node.nextNodeId].filter(Boolean);
  if (node.type === "question") {
    return [node.correctNextNodeId, node.incorrectNextNodeId].filter(Boolean);
  }
  return [];
}

function hasCycle(startNodeId, outgoing) {
  const visiting = new Set();
  const visited = new Set();
  function visit(nodeId) {
    if (visiting.has(nodeId)) return true;
    if (visited.has(nodeId)) return false;
    visiting.add(nodeId);
    for (const target of outgoing.get(nodeId) || []) {
      if (visit(target)) return true;
    }
    visiting.delete(nodeId);
    visited.add(nodeId);
    return false;
  }
  return visit(startNodeId);
}

function walkForward(startNodeId, outgoing) {
  const visited = new Set();
  const queue = [startNodeId];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current)) continue;
    visited.add(current);
    for (const target of outgoing.get(current) || []) queue.push(target);
  }
  return visited;
}

function walkBackward(endingIds, outgoing) {
  const reverse = new Map();
  for (const [from, targets] of outgoing) {
    for (const target of targets) {
      const sources = reverse.get(target) || [];
      sources.push(from);
      reverse.set(target, sources);
    }
  }
  const visited = new Set();
  const queue = [...endingIds];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current)) continue;
    visited.add(current);
    for (const source of reverse.get(current) || []) queue.push(source);
  }
  return visited;
}

function scopedInteger(value, expected, label, issues) {
  const parsed = positiveInteger(value ?? expected, label, issues);
  const expectedNumber = Number(expected || 0);
  if (expectedNumber > 0 && parsed > 0 && parsed !== expectedNumber) {
    issues.push(`${label} ${parsed} does not match requested scope ${expectedNumber}`);
  }
  return parsed;
}

function positiveInteger(value, label, issues) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    issues.push(`${label} must be a positive integer`);
    return 0;
  }
  return parsed;
}

function requiredText(value, label, issues) {
  const result = optionalText(value);
  if (!result) issues.push(`${label} is required`);
  return result;
}

function optionalText(value) {
  return value == null ? "" : String(value).trim().slice(0, 4000);
}

function safeUrl(value, label = "url", issues = []) {
  const result = optionalText(value);
  if (!result) return "";
  if (result.startsWith("/")) return result;
  try {
    const parsed = new URL(result);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") return parsed.toString();
  } catch {
    // Report the common validation error below.
  }
  issues.push(`${label} must be an HTTP(S) or root-relative URL`);
  return "";
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
